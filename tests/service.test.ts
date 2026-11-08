import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createUsageService, UsageError } from '../src/service.ts'

const usage = { windows: [{ id: 'main', label: 'Weekly', used: 27, extra: false }] }
const account = { id: 'a', label: 'user@example.com' }

test('60-second polling refreshes every minute even with network latency', async () => {
  let now = 0, calls = 0
  const service = createUsageService({ now: () => now, read: async ({ onAccount }) => {
    calls++; onAccount(account); now += 100; return usage
  } })
  await service.get()
  now = 60000; await service.get()
  now = 120000; await service.get()
  assert.equal(calls, 3)
})

test('snapshots are valid RPC JSON with absent optional fields omitted', async () => {
  const service = createUsageService({ read: async ({ onAccount }) => {
    onAccount(account)
    return { ...usage, limitReached: undefined, credits: { balance: 0, unlimited: undefined } }
  } })
  const result = await service.get()
  assert.deepEqual(result, JSON.parse(JSON.stringify(result)))
})

test('deduplicates concurrent refreshes and respects the one-minute cache', async () => {
  let calls = 0, now = 0
  const service = createUsageService({ now: () => now, read: async ({ onAccount }) => {
    calls++; onAccount(account); await Promise.resolve(); return usage
  } })
  const [a, b] = await Promise.all([service.get(), service.get()])
  assert.deepEqual(a, b)
  assert.equal(a.usage?.windows[0].used, 27)
  await service.get(); assert.equal(calls, 1)
  now = 60000; await service.get(); assert.equal(calls, 2)
})

test('keeps stale values only after positively identifying the same account', async () => {
  let now = 0, fail = false
  const service = createUsageService({ now: () => now, read: async ({ onAccount }) => {
    onAccount(account)
    if (fail) throw new Error('SECRET TOKEN')
    return usage
  } })
  await service.get(); now = 60000; fail = true
  const result = await service.get()
  assert.equal(result.state, 'stale')
  assert.equal(result.updatedAt, 0)
  assert.equal(result.usage?.windows[0].used, 27)
  assert.equal(JSON.stringify(result).includes('SECRET'), false)
})

test('clears old quotas on account switch and when identity cannot be read', async () => {
  let now = 0, phase = 0
  const service = createUsageService({ now: () => now, read: async ({ onAccount }) => {
    if (phase === 2) throw new Error('cannot identify')
    onAccount(phase === 1 ? { id: 'b', label: 'second' } : account)
    if (phase) throw new UsageError('unavailable')
    return usage
  } })
  await service.get(); phase = 1; now = 60000
  assert.equal((await service.get()).usage, undefined)
  phase = 2; now = 120000
  assert.equal((await service.get()).account, undefined)
})

test('safe no-login, unsupported and rate-limit states with backoff', async () => {
  for (const code of ['login', 'unsupported', 'rate-limit'] as const) {
    let now = 0, calls = 0
    const service = createUsageService({ now: () => now, read: async () => { calls++; throw new UsageError(code) } })
    const result = await service.get()
    assert.equal(result.state, 'unavailable')
    assert.ok(result.message)
    now = 59000; await service.get(); assert.equal(calls, 1)
    if (code === 'rate-limit') { now = 60000; await service.get(); assert.equal(calls, 1) }
  }
})

test('passes a timeout signal to transport and releases failed requests', async () => {
  let now = 0
  const service = createUsageService({ now: () => now, read: async ({ signal }) => {
    assert.ok(signal instanceof AbortSignal)
    throw new DOMException('secret upstream details', 'TimeoutError')
  } })
  assert.equal((await service.get()).state, 'unavailable')
  now = 60000
  assert.ok((await service.get()).message?.includes('timed out'))
})
