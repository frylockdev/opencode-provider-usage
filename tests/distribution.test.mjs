import { test } from 'node:test'
import assert from 'node:assert/strict'
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { testRender } from '@opentui/solid'

test('distributed TUI loads from node_modules and renders live RPC data', async () => {
  await mkdir('.superpowers', { recursive: true })
  const temp = await mkdtemp(resolve('.superpowers/distribution-'))
  let screen
  try {
    const target = join(temp, 'node_modules/opencode-provider-usage')
    await mkdir(target, { recursive: true })
    const pkg = JSON.parse(await readFile('package.json', 'utf8'))
    await copyFile(pkg.exports['./tui'], join(target, 'tui.js'))
    const { default: plugin } = await import(pathToFileURL(join(target, 'tui.js')).href)
    let render
    const text = { base: '#ffffff', muted: '#999999', faint: '#333333', action: { primary: { base: '#aa88ff' } }, feedback: { success: { base: '#00ff00' }, warning: { base: '#ff8800' }, error: { base: '#ff0000' } } }
    await plugin.setup({
      ui: { slot: claim => { render = claim.render; return () => {} }, model: { current: () => ({ providerID: 'openai' }) } },
      client: { rpc: () => ({ get: async () => ({ state: 'ready', checkedAt: Date.now(), updatedAt: Date.now(),
        usage: { plan: 'pro', windows: [{ id: 'week', label: 'Weekly', used: 27, extra: false }] } }) }) },
      data: { location: { default: () => ({ directory: '/' }) } },
      keymap: { layer() {} }, theme: { text },
    })
    screen = await testRender(() => render(), { width: 32, height: 30 })
    await screen.waitForFrame(frame => frame.includes('73% remaining'))
    assert.match(screen.captureCharFrame(), /27% used/)
  } finally {
    if (screen) await screen.dispose()
    await rm(temp, { recursive: true, force: true })
  }
})
