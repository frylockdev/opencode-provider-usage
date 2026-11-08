export type UsageWindow = {
  id: string
  label: string
  used: number
  resetAt?: number
  extra: boolean
}

export type Usage = {
  plan?: string
  allowed?: boolean
  limitReached?: boolean
  windows: UsageWindow[]
  credits?: { hasCredits?: boolean; unlimited?: boolean; balance?: number }
  budget?: { limit?: number; used?: number; remainingPercent?: number; resetAt?: number }
  details?: { label: string; value: string }[]
  resetCredits?: { available: number; items: { title?: string; status?: string; expiresAt?: number }[] }
  buckets?: { label: string; credits?: Usage['credits']; budget?: Usage['budget'] }[]
}

export function hasUsage(usage: Usage): boolean {
  return !!(usage.windows.length || usage.credits || usage.budget || usage.buckets?.length || usage.resetCredits
    || usage.allowed !== undefined || usage.limitReached !== undefined)
}

export function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {}
}

export function safeText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  return value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').trim().slice(0, 80) || undefined
}

function number(value: unknown): number | undefined {
  if (typeof value === 'string' && /^\d+(\.\d+)?$/.test(value.trim())) value = Number(value)
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

function percent(value: unknown): number | undefined {
  const n = number(value)
  return n !== undefined && n <= 100 ? n : undefined
}

function boolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function timestamp(value: unknown): number | undefined {
  const n = number(value)
  return n !== undefined && n > 0 && n < 8640000000000 ? n * 1000 : undefined
}

function windowLabel(seconds: unknown, fallback: string): string {
  const n = number(seconds)
  if (n === 604800) return 'Weekly'
  if (n === 18000) return '5 hours'
  if (!n) return fallback
  if (n % 86400 === 0) return `${n / 86400}d`
  if (n % 3600 === 0) return `${n / 3600}h`
  return `${Math.ceil(n / 60)}m`
}

export function normalizeUsage(input: unknown): Usage {
  const root = record(input)
  const rate = record(root.rate_limit)
  const windows: UsageWindow[] = []
  function addWindows(value: unknown, id: string, name = '', extra = false) {
    const group = record(value)
    for (const [key, fallback] of [['primary_window', 'Primary limit'], ['secondary_window', 'Secondary limit']]) {
      const window = record(group[key])
      const used = percent(window.used_percent)
      if (used === undefined) continue
      windows.push({ id: `${id}.${key}`, label: [name, windowLabel(window.limit_window_seconds, fallback)].filter(Boolean).join(' · '),
        used, resetAt: timestamp(window.reset_at), extra })
    }
  }
  addWindows(rate, 'main')
  if (Array.isArray(root.additional_rate_limits)) {
    root.additional_rate_limits.slice(0, 50).forEach((value, i) => {
      const item = record(value)
      addWindows(item.rate_limit, `extra.${i}`, safeText(item.limit_name) ?? safeText(item.metered_feature) ?? 'Additional limit', true)
    })
  }
  addWindows(root.code_review_rate_limit, 'review', 'Code review', true)
  const credits = record(root.credits)
  const spend = record(root.spend_control ?? root.spendControl)
  const budget = record(root.individual_limit ?? root.individualLimit ?? rate.individual_limit ?? rate.individualLimit ?? spend.individual_limit ?? spend.individualLimit)
  const result: Usage = {
    plan: safeText(root.plan_type),
    allowed: boolean(rate.allowed), limitReached: boolean(rate.limit_reached), windows,
    ...(Object.keys(credits).length ? { credits: {
      hasCredits: boolean(credits.has_credits), unlimited: boolean(credits.unlimited), balance: number(credits.balance),
    } } : {}),
    ...(Object.keys(budget).length ? { budget: {
      limit: number(budget.limit), used: number(budget.used), remainingPercent: percent(budget.remaining_percent ?? budget.remainingPercent),
      resetAt: timestamp(budget.reset_at ?? budget.resets_at ?? budget.resetsAt),
    } } : {}),
  }
  if (result.credits && !Object.values(result.credits).some(value => value !== undefined)) delete result.credits
  if (result.budget && !Object.values(result.budget).some(value => value !== undefined)) delete result.budget
  if (!hasUsage(result)) {
    throw new Error('Usage unavailable')
  }
  return result
}

export function progress(used: number, width: number): { filled: string; empty: string } {
  const size = Math.max(0, Math.floor(width))
  const filled = Math.round(Math.min(100, Math.max(0, used)) / 100 * size)
  return { filled: '━'.repeat(filled), empty: '━'.repeat(size - filled) }
}

export function remainingTime(resetAt: number | undefined, now: number): string {
  if (resetAt === undefined) return 'time unknown'
  if (resetAt <= now) return 'awaiting reset'
  const minutes = Math.floor((resetAt - now) / 60000)
  if (minutes < 1) return '< 1m'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${minutes % 60}m`
  return `${Math.floor(hours / 24)}d ${hours % 24}h`
}
