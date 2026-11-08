import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createInterface } from 'node:readline'
import { homedir } from 'node:os'
import { hasUsage, normalizeUsage, record, safeText, type Usage } from './usage.ts'
import { UsageError, type ReadInput } from './service.ts'

export function normalizeCodexUsage(input: unknown): Usage {
  const root = record(input)
  const buckets = record(root.rateLimitsByLimitId)
  const main = record(buckets.codex ?? root.rateLimits)
  function rate(value: unknown) {
    const bucket = record(value)
    function window(value: unknown) {
      const w = record(value)
      return { used_percent: w.usedPercent, reset_at: w.resetsAt,
        limit_window_seconds: typeof w.windowDurationMins === 'number' ? w.windowDurationMins * 60 : undefined }
    }
    return { primary_window: window(bucket.primary), secondary_window: window(bucket.secondary) }
  }
  const credits = record(main.credits)
  let usage: Usage
  try { usage = normalizeUsage({
    plan_type: main.planType,
    rate_limit: { ...rate(main), allowed: root.ordinaryUsageAllowed,
      limit_reached: safeText(main.rateLimitReachedType) ? true : undefined },
    additional_rate_limits: Object.entries(buckets).filter(([id]) => id !== 'codex' && id !== main.limitId).map(([id, value]) => ({
      limit_name: record(value).limitName ?? id, rate_limit: rate(value),
    })),
    credits: Object.keys(credits).length ? { has_credits: credits.hasCredits, unlimited: credits.unlimited, balance: credits.balance } : undefined,
    individual_limit: main.individualLimit,
  }) } catch { usage = { plan: safeText(main.planType), windows: [] } }
  const extras: NonNullable<Usage['buckets']> = []
  for (const [id, value] of Object.entries(buckets)) {
    if (id === 'codex' || id === main.limitId) continue
    const bucket = record(value)
    const credits = record(bucket.credits)
    try {
      const metrics = normalizeUsage({
        credits: { has_credits: credits.hasCredits, unlimited: credits.unlimited, balance: credits.balance },
        individual_limit: bucket.individualLimit,
      })
      extras.push({ label: safeText(bucket.limitName) ?? safeText(id) ?? 'Доп. лимит', credits: metrics.credits, budget: metrics.budget })
    } catch { /* Некорректный доп. бюджет не должен скрывать остальные квоты. */ }
  }
  if (extras.length) usage.buckets = extras
  const details: { label: string; value: string }[] = []
  for (const [id, value] of Object.entries(Object.keys(buckets).length ? buckets : { codex: main })) {
    const bucket = record(value)
    const label = safeText(bucket.limitName) ?? safeText(id) ?? 'Лимит'
    const reached = safeText(bucket.rateLimitReachedType)
    if (reached) details.push({ label: `${label} · ограничение`, value: reached })
    if (typeof bucket.spendControlReached === 'boolean') details.push({ label: `${label} · бюджет исчерпан`, value: bucket.spendControlReached ? 'да' : 'нет' })
    const model = safeText(bucket.normalModelSlug)
    if (model) details.push({ label: `${label} · модель`, value: model })
  }
  usage.details = details
  const resets = record(root.rateLimitResetCredits)
  if (typeof resets.availableCount === 'number' && Number.isInteger(resets.availableCount) && resets.availableCount >= 0) {
    usage.resetCredits = { available: resets.availableCount,
      items: (Array.isArray(resets.credits) ? resets.credits : []).slice(0, 50).map(value => {
        const item = record(value)
        return { title: safeText(item.title), status: safeText(item.status),
          expiresAt: typeof item.expiresAt === 'number' && item.expiresAt > 0 && item.expiresAt < 8640000000000 ? item.expiresAt * 1000 : undefined }
      }) }
  }
  if (!hasUsage(usage)) throw new UsageError('unavailable')
  return usage
}

export async function readCodexUsage(input: ReadInput, start: () => ChildProcessWithoutNullStreams = () =>
  spawn('codex', ['app-server'], { cwd: homedir(), stdio: ['pipe', 'pipe', 'pipe'] }),
): Promise<Usage> {
  input.signal.throwIfAborted()
  const child = start()
  const lines = createInterface({ input: child.stdout })
  child.stderr.resume()
  let serial = 0
  const pending = new Map<number, { resolve(value: unknown): void; reject(error: unknown): void }>()
  let stopped: unknown
  function fail(error: unknown) {
    stopped = error
    for (const request of pending.values()) request.reject(error)
    pending.clear()
  }
  const abort = () => fail(input.signal.reason)
  input.signal.addEventListener('abort', abort, { once: true })
  child.on('error', () => fail(new UsageError('missing')))
  child.stdin.on('error', () => fail(new UsageError('unavailable')))
  child.on('exit', () => fail(new UsageError('unavailable')))
  lines.on('line', line => {
    try {
      const msg = record(JSON.parse(line))
      if (typeof msg.id !== 'number') return
      const request = pending.get(msg.id)
      if (!request) return
      pending.delete(msg.id)
      if (msg.error) {
        const error = record(msg.error)
        request.reject(new UsageError(/\b429\b|rate.limit/i.test(String(error.message)) ? 'rate-limit' : 'unavailable'))
      } else request.resolve(msg.result)
    } catch { fail(new UsageError('unavailable')) }
  })
  function send(message: unknown) { child.stdin.write(`${JSON.stringify(message)}\n`) }
  function call(method: string, params: unknown = {}) {
    if (stopped) return Promise.reject(stopped)
    const id = ++serial
    return new Promise<unknown>((resolve, reject) => {
      pending.set(id, { resolve, reject })
      send({ id, method, params })
    })
  }
  try {
    await call('initialize', { clientInfo: { name: 'opencode_usage', title: 'OpenCode Usage', version: '0.1.0' } })
    send({ method: 'initialized', params: {} })
    const info = record(await call('account/read', { refreshToken: false }))
    if (!info.account) throw new UsageError('login')
    const account = record(info.account)
    if (account.type !== 'chatgpt') throw new UsageError('unsupported')
    const label = [safeText(account.email), safeText(account.workspaceName)].filter(Boolean).join(' · ')
    if (!label) throw new UsageError('unavailable')
    const response = record(await call('account/rateLimits/read'))
    // Названия workspace могут совпадать; только ответ usage подтверждает владельца квот.
    if (typeof response.accountId === 'string' && response.accountId) input.onAccount({ id: response.accountId, label })
    const usage = normalizeCodexUsage(response)
    usage.plan ??= safeText(account.planType)
    return usage
  } finally {
    input.signal.removeEventListener('abort', abort)
    lines.close()
    child.stdin.end()
    child.kill()
    const kill = setTimeout(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL') }, 1000)
    kill.unref()
    child.once('exit', () => clearTimeout(kill))
  }
}
