import { Plugin } from '@opencode/plugin/tui'
import { createSignal, onCleanup, onMount } from 'solid-js'
import { OpenAIUsage } from './rpc.ts'
import type { UsageSnapshot } from './service.ts'
import { UsagePanel } from './panel.tsx'

export default Plugin.define({
  id: 'openai-usage.tui',
  setup(context) {
    const [expanded, setExpanded] = createSignal(false)
    const toggle = () => { setExpanded(value => !value) }
    return context.ui.slot({ append: 'sidebar.content', render: () => {
      const [snapshot, setSnapshot] = createSignal<UsageSnapshot>()
      const [now, setNow] = createSignal(Date.now())
      const [loading, setLoading] = createSignal(false)
      let disposed = false
      let request: AbortController | undefined
      async function refresh() {
        if (loading() || disposed) return
        setLoading(true)
        request = new AbortController()
        try {
          const result = await context.client.rpc(OpenAIUsage).get({}, {
            location: context.location ?? context.data.location.default(),
            signal: AbortSignal.any([request.signal, AbortSignal.timeout(20000)]),
          })
          if (!disposed) setSnapshot(result as UsageSnapshot)
        } catch {
          if (!disposed) setSnapshot(previous => ({ ...previous, state: previous?.usage ? 'stale' : 'unavailable',
            checkedAt: Date.now(), message: 'Cannot reach the OpenCode server' }))
        } finally { request = undefined; if (!disposed) { setLoading(false); setNow(Date.now()) } }
      }
      onMount(() => {
        void refresh()
        const poll = setInterval(() => void refresh(), 60000)
        const clock = setInterval(() => setNow(Date.now()), 10000)
        onCleanup(() => { disposed = true; request?.abort(); clearInterval(poll); clearInterval(clock) })
      })
      context.keymap.layer(() => ({ mode: 'global', commands: [
        { id: 'openai-usage.details', title: 'OpenAI Usage: Toggle details', group: 'Usage', palette: true, slash: { name: 'usage' }, run: toggle },
        { id: 'openai-usage.refresh', title: 'OpenAI Usage: Refresh', group: 'Usage', palette: true, run: refresh },
      ] }))
      return <UsagePanel snapshot={snapshot()} now={now()} expanded={expanded()} toggle={toggle} refresh={() => void refresh()} loading={loading()}
        active={context.ui.model.current()?.providerID === 'openai'} colors={{
          text: context.theme.text.base, muted: context.theme.text.muted, faint: context.theme.text.faint,
          accent: context.theme.text.action.primary.base, success: context.theme.text.feedback.success.base,
          warning: context.theme.text.feedback.warning.base, error: context.theme.text.feedback.error.base,
        }} />
    } })
  },
})
