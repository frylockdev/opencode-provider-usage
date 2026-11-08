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
      case 'login': return 'Войдите в Codex: codex login'
      case 'unsupported': return 'Нужен вход Codex через ChatGPT'
      case 'rate-limit': return 'OpenAI ограничил обновления · повтор через 5м'
      case 'missing': return 'Codex CLI не найден'
    }
  }
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) return 'Истекло время ожидания Codex'
  return 'Не удалось получить лимиты Codex'
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
        // RPC проверяет JSON до сериализации, поэтому undefined нужно убрать здесь.
        snapshot = JSON.parse(JSON.stringify(snapshot)) as UsageSnapshot
        return snapshot
      })().finally(() => { pending = undefined })
      return pending
    },
  }
}
