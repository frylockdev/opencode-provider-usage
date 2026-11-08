import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeUsage, progress, remainingTime } from '../src/usage.ts'

test('normalizes all windows without leaking raw account fields', () => {
  const usage = normalizeUsage({
    account_id: 'private', email: 'private@example.com', plan_type: 'pro',
    rate_limit: { allowed: true, limit_reached: false,
      primary_window: { used_percent: 18, limit_window_seconds: 18000, reset_at: 1800000000 },
      secondary_window: { used_percent: 81, limit_window_seconds: 604800, reset_at: 1800500000 } },
    additional_rate_limits: [null, { limit_name: 'Spark', rate_limit: {
      primary_window: { used_percent: 32, limit_window_seconds: 18000 } } }],
    code_review_rate_limit: { primary_window: { used_percent: 0, limit_window_seconds: 604800 } },
  })
  assert.equal(usage.plan, 'pro')
  assert.deepEqual(usage.windows.map(w => [w.label, w.used, w.extra]), [
    ['5 часов', 18, false], ['Неделя', 81, false], ['Spark · 5 часов', 32, true], ['Code review · Неделя', 0, true],
  ])
  assert.equal(usage.windows[0].resetAt, 1800000000000)
  assert.equal(usage.allowed, true)
  assert.equal(JSON.stringify(usage).includes('private'), false)
})

test('missing and malformed windows are not reported as zero', () => {
  const usage = normalizeUsage({ rate_limit: {
    primary_window: { used_percent: null }, secondary_window: { used_percent: 'bad' },
  }, additional_rate_limits: [false, { rate_limit: { primary_window: { used_percent: 52 } } }] })
  assert.equal(usage.windows.length, 1)
  assert.equal(usage.windows[0].used, 52)
  assert.equal(usage.windows[0].resetAt, undefined)
  assert.throws(() => normalizeUsage(null))
  assert.throws(() => normalizeUsage({ error: 'unauthorized' }))
})

test('rejects invalid percentages and preserves valid neighbors', () => {
  const usage = normalizeUsage({ rate_limit: { primary_window: { used_percent: -4 },
    secondary_window: { used_percent: 100 } }, additional_rate_limits: [
      { rate_limit: { primary_window: { used_percent: Infinity }, secondary_window: { used_percent: 101 } } },
  ] })
  assert.deepEqual(usage.windows.map(w => w.used), [100])
})

test('credits and spend-control remain credits, preserve zero and precedence', () => {
  const usage = normalizeUsage({ credits: { has_credits: true, unlimited: false, balance: '12.50' },
    individual_limit: { limit: '100', used: 0, remaining_percent: '100', reset_at: '1800000000' },
    spend_control: { individual_limit: { limit: 500, used: 400 } } })
  assert.deepEqual(usage.credits, { hasCredits: true, unlimited: false, balance: 12.5 })
  assert.deepEqual(usage.budget, { limit: 100, used: 0, remainingPercent: 100, resetAt: 1800000000000 })
  assert.equal(normalizeUsage({ spend_control: { individual_limit: { limit: 200 } } }).budget?.limit, 200)
  assert.throws(() => normalizeUsage({ credits: { balance: '', has_credits: 'false' } }))
})

test('malformed optional metrics cannot turn unavailable usage into success', () => {
  assert.throws(() => normalizeUsage({ credits: { balance: 'oops' } }))
  assert.throws(() => normalizeUsage({ individual_limit: { limit: null, used: 'oops' } }))
})

test('terminal strings remove control characters and stay bounded', () => {
  const usage = normalizeUsage({ plan_type: 'pro\n\u001b[31m', rate_limit: { primary_window: { used_percent: 10 } } })
  assert.ok(!/[\n\u001b]/.test(usage.plan!))
})

test('progress handles zero, full and narrow bars', () => {
  assert.deepEqual(progress(0, 10), { filled: '', empty: '━━━━━━━━━━' })
  assert.deepEqual(progress(100, 10), { filled: '━━━━━━━━━━', empty: '' })
  assert.deepEqual(progress(42, 10), { filled: '━━━━', empty: '━━━━━━' })
  assert.deepEqual(progress(50, 1), { filled: '━', empty: '' })
})

test('countdown distinguishes unavailable, elapsed and future resets', () => {
  assert.equal(remainingTime(undefined, 0), 'время неизвестно')
  assert.equal(remainingTime(0, 100), 'ожидаем сброс')
  assert.equal(remainingTime(1000, 0), '< 1м')
  assert.equal(remainingTime(4800000, 0), '1ч 20м')
  assert.equal(remainingTime(190800000, 0), '2д 5ч')
})
