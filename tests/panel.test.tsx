import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSignal } from 'solid-js'
import { testRender } from '@opentui/solid'
import { UsagePanel } from '../src/panel.tsx'
import type { UsageSnapshot } from '../src/service.ts'

const colors = { text: '#f8f8f2', muted: '#999999', faint: '#444444', accent: '#bd93f9', warning: '#ffb86c', error: '#ff5555', success: '#50fa7b' }
const snapshot: UsageSnapshot = { state: 'ready', checkedAt: 0, updatedAt: 0, account: 'user@example.com', usage: {
  plan: 'prolite', windows: [{ id: 'week', label: 'Неделя', used: 27, resetAt: 190800000, extra: false },
    { id: 'spark', label: 'Spark', used: 100, extra: true }], credits: { balance: 0 },
  resetCredits: { available: 2, items: [] },
  buckets: [{ label: 'Extra', credits: { balance: 12 }, budget: { limit: 50, used: 10 } }],
} }

test('real terminal renderer shows compact quotas and expands details', async () => {
  const [expanded, setExpanded] = createSignal(false)
  const screen = await testRender(() => <UsagePanel snapshot={snapshot} now={0} expanded={expanded()} toggle={() => setExpanded(!expanded())} refresh={() => {}} colors={colors} active={true} />, { width: 32, height: 60 })
  try {
    await screen.renderOnce()
    const compact = screen.captureCharFrame()
    assert.match(compact, /73% осталось/)
    assert.match(compact, /27% использовано/)
    assert.match(compact, /2д 5ч/)
    assert.doesNotMatch(compact, /Spark/)
    setExpanded(true)
    await screen.renderOnce()
    const detailed = screen.captureCharFrame()
    assert.match(detailed, /Spark/)
    assert.match(detailed, /0% осталось/)
    assert.match(detailed, /Кредиты: 0/)
    assert.match(detailed, /Сбросы лимита: 2/)
    assert.match(detailed, /Кредиты: 12/)
    assert.match(detailed, /Бюджет: 50 кредитов/)
    screen.resize(24, 80)
    await screen.renderOnce()
    assert.match(screen.captureCharFrame(), /73% осталось/)
  } finally { await screen.dispose() }
})

test('stale and unavailable states do not invent zero usage', async () => {
  const [value, setValue] = createSignal<UsageSnapshot>({ ...snapshot, state: 'stale', message: 'Нет связи' })
  const screen = await testRender(() => <UsagePanel snapshot={value()} now={120000} expanded={false} toggle={() => {}} refresh={() => {}} colors={colors} />, { width: 32, height: 40 })
  try {
    await screen.renderOnce()
    assert.match(screen.captureCharFrame(), /Данные устарели/)
    setValue({ state: 'unavailable', checkedAt: 0, message: 'Войдите в Codex' })
    await screen.renderOnce()
    assert.match(screen.captureCharFrame(), /Войдите в Codex/)
    assert.doesNotMatch(screen.captureCharFrame(), /0%/)
  } finally { await screen.dispose() }
})
