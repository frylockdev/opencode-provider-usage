import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { JSX } from 'solid-js'
import type { Context } from '@opencode/plugin/tui/context'
import { testRender } from '@opentui/solid'
import plugin from '../src/tui.tsx'

test('unmount aborts an outstanding RPC and removes polling timers', async () => {
  let render: () => JSX.Element = () => null
  let signal: AbortSignal | undefined
  let calls = 0
  const controller = new AbortController()
  const text = { base: '#ffffff', muted: '#999999', faint: '#333333', action: { primary: { base: '#aa88ff' } }, feedback: { success: { base: '#00ff00' }, warning: { base: '#ff8800' }, error: { base: '#ff0000' } } }
  const context = {
    ui: { slot: (claim: { render: () => JSX.Element }) => { render = claim.render; return () => {} }, model: { current: () => undefined } },
    client: { rpc: () => ({ get: (_input: unknown, options: { signal?: AbortSignal }) => {
      calls++; signal = options.signal
      return new Promise((_resolve, reject) => (signal ?? controller.signal).addEventListener('abort', () => reject(new Error('cancelled')), { once: true }))
    } }) },
    data: { location: { default: () => ({ directory: '/' }) } },
    keymap: { layer: () => {} }, theme: { text },
  } as unknown as Context
  await plugin.setup(context)
  const screen = await testRender(() => render(), { width: 32, height: 40 })
  try {
    await screen.renderOnce()
    assert.equal(calls, 1)
    assert.ok(signal, 'RPC must receive its timeout/cancellation signal')
    await screen.dispose()
    assert.equal(signal.aborted, true)
  } finally { controller.abort(); if (!screen.renderer.isDestroyed) await screen.dispose() }
})
