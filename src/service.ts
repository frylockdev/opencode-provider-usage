import type { Usage } from './usage.ts'

export type Account = { id: string; label: string }
export type UsageSnapshot = {
  state: 'ready' | 'stale' | 'unavailable'
  account?: string
  usage?: Usage
  updatedAt?: number
  checkedAt: number
  retryAt?: number
  message?: string
}
export type ReadInput = { signal: AbortSignal; onAccount: (account: Account) => void }

export class UsageError extends Error {
  readonly code: 'login' | 'unsupported' | 'rate-limit' | 'missing' | 'unavailable'
  constructor(code: UsageError['code']) { super(code); this.code = code }
}

function message(error: unknown): string {
  if (error instanceof UsageError) {
    switch (error.code) {
      case 'login': return 'Sign in to Codex: codex login'
      case 'unsupported': return 'Sign in to Codex with ChatGPT'
      case 'rate-limit': return 'OpenAI rate limit · retry in 5m'
      case 'missing': return 'Codex CLI not found'
    }
  }
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) return 'Codex request timed out'
  return 'Could not fetch Codex usage'
}

export function createUsageService({ read, now = Date.now }: {
  read: (input: ReadInput) => Promise<Usage>
  now?: () => number
}) {
  let snapshot: UsageSnapshot | undefined
  let key: string | undefined
  let pending: Promise<UsageSnapshot> | undefined
  let next = 0
  return {
    get(): Promise<UsageSnapshot> {
      if (pending) return pending
      if (snapshot && now() < next) return Promise.resolve(snapshot)
      const startedAt = now()
      pending = (async () => {
        let account: Account | undefined
        try {
          const usage = await read({ signal: AbortSignal.timeout(15000), onAccount(value) {
            account = value
            if (key !== value.id) snapshot = undefined
            key = value.id
          } })
          snapshot = { state: 'ready', account: account?.label, usage, updatedAt: now(), checkedAt: now() }
          next = startedAt + 60000
        } catch (error) {
          if (!account) { snapshot = undefined; key = undefined }
          next = now() + (error instanceof UsageError && error.code === 'rate-limit' ? 300000 : 60000)
          snapshot = { state: snapshot?.usage ? 'stale' : 'unavailable',
            account: account?.label, usage: snapshot?.usage, updatedAt: snapshot?.updatedAt,
            checkedAt: now(), retryAt: next, message: message(error) }
        }
        // RPC validates JSON before serialization, so strip undefined values here.
        snapshot = JSON.parse(JSON.stringify(snapshot)) as UsageSnapshot
        return snapshot
      })().finally(() => { pending = undefined })
      return pending
    },
  }
}
