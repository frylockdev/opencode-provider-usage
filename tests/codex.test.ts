import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readCodexUsage, normalizeCodexUsage } from '../src/codex.ts'
import { createUsageService } from '../src/service.ts'

test('blank exhaustion metadata must not tell the user their limit is exhausted', () => {
  const result = normalizeCodexUsage({ rateLimits: { primary: { usedPercent: 27 }, rateLimitReachedType: '' } })
  assert.notEqual(result.limitReached, true)
})

test('additional bucket credits and budgets and reset-only responses survive', () => {
  const result = normalizeCodexUsage({ rateLimitsByLimitId: { spark: { limitName: 'Spark',
    credits: { balance: '12' }, individualLimit: { limit: 100, used: 10 } } } })
  assert.equal(result.buckets?.[0].label, 'Spark')
  assert.equal(result.buckets?.[0].credits?.balance, 12)
  assert.equal(result.buckets?.[0].budget?.used, 10)
  assert.equal(normalizeCodexUsage({ rateLimitResetCredits: { availableCount: 0, credits: [] } }).resetCredits?.available, 0)
})

test('malformed response after success retains stale metrics, never ready empty data', async () => {
  let now = 0
  const service = createUsageService({ now: () => now, read: async ({ onAccount }) => {
    onAccount({ id: 'stable', label: 'user' })
    return normalizeCodexUsage(now === 0 ? { rateLimits: { primary: { usedPercent: 27 } } } : { rateLimits: { credits: { balance: 'oops' } } })
  } })
  await service.get(); now = 60000
  const result = await service.get()
  assert.equal(result.state, 'stale')
  assert.equal(result.usage?.windows[0].used, 27)
})

test('normalizes multi-bucket Codex limits, credits and additional metadata', () => {
  const main = { primary: { usedPercent: 27, windowDurationMins: 10080, resetsAt: 1800000000 },
    planType: 'prolite', credits: { hasCredits: false, unlimited: false, balance: '0' },
    individualLimit: { limit: 50, used: 10, remainingPercent: 80 }, spendControlReached: false }
  const result = normalizeCodexUsage({ rateLimits: main, rateLimitsByLimitId: { codex: main,
    spark: { limitName: 'Spark', primary: { usedPercent: 12, windowDurationMins: 300 } } },
    ordinaryUsageAllowed: true, rateLimitResetCredits: { availableCount: 2, credits: [{ id: 'private', title: 'Reset', status: 'available', expiresAt: 1800000000 }] },
  })
  assert.equal(result.windows.length, 2)
  assert.equal(result.windows[0].label, 'Weekly')
  assert.equal(result.windows[1].label, 'Spark · 5 hours')
  assert.equal(result.plan, 'prolite')
  assert.equal(result.credits?.balance, 0)
  assert.equal(result.budget?.limit, 50)
  assert.equal(result.resetCredits?.available, 2)
  assert.equal(result.allowed, true)
  assert.equal(JSON.stringify(result).includes('private'), false)
})

function fakeProcess(mode = 'ok') {
  return spawn(process.execPath, ['--input-type=module', '-e', `
    import {createInterface} from 'node:readline';
    let initialized = false;
    createInterface({input:process.stdin}).on('line', line => {
      const m = JSON.parse(line);
      if(m.method === 'initialized') { initialized = true; return; }
      const result = m.method === 'initialize' ? {} : m.method === 'account/read' && initialized
        ? {account: ${mode === 'login' ? 'null' : "{type:'chatgpt',email:'user@example.com',workspaceName:null,planType:'pro'}"}}
        : m.method === 'account/rateLimits/read' && initialized
        ? ${mode === 'failure' ? "undefined" : `{accountId:'${mode === 'other' ? 'workspace-b' : 'workspace-a'}',rateLimits:{primary:{usedPercent:27,windowDurationMins:10080}}}`}
        : undefined;
      process.stdout.write(JSON.stringify(result ? {id:m.id,result} : {id:m.id,error:{message:'PRIVATE'}})+'\\n');
    });
  `], { stdio: ['pipe', 'pipe', 'pipe'] })
}

test('uses account/rateLimits/read after handshake without starting a model turn', async () => {
  const child = fakeProcess()
  const accounts: unknown[] = []
  const usage = await readCodexUsage({ signal: AbortSignal.timeout(5000), onAccount: a => accounts.push(a) }, () => child)
  assert.equal(usage.windows[0].used, 27)
  assert.equal(accounts.length, 1)
  assert.equal(child.killed, true)
})

test('cache identity comes from stable usage accountId, not matching labels', async () => {
  const accounts: { id: string; label: string }[] = []
  for (const mode of ['ok', 'other']) await readCodexUsage({ signal: AbortSignal.timeout(5000), onAccount: a => accounts.push(a) }, () => fakeProcess(mode))
  assert.equal(accounts[0].label, accounts[1].label)
  assert.notEqual(accounts[0].id, accounts[1].id)
  const unconfirmed: unknown[] = []
  await assert.rejects(readCodexUsage({ signal: AbortSignal.timeout(5000), onAccount: a => unconfirmed.push(a) }, () => fakeProcess('failure')))
  assert.equal(unconfirmed.length, 0)
})

test('no login and process failure are redacted and cleaned up', async () => {
  const child = fakeProcess('login')
  await assert.rejects(readCodexUsage({ signal: AbortSignal.timeout(5000), onAccount() {} }, () => child), { code: 'login' })
  assert.equal(child.killed, true)
})

test('aborting a hung subprocess terminates it', async () => {
  const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { stdio: ['pipe', 'pipe', 'pipe'] })
  const controller = new AbortController()
  const result = readCodexUsage({ signal: controller.signal, onAccount() {} }, () => child)
  controller.abort()
  await assert.rejects(result)
  assert.equal(child.killed, true)
})
