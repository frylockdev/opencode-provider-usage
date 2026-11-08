import { For, Show, createSignal } from 'solid-js'
import type { RGBA } from '@opentui/core'
import type { UsageSnapshot } from './service.ts'
import { progress, remainingTime, type Usage, type UsageWindow } from './usage.ts'

type Colors = Record<'text' | 'muted' | 'faint' | 'accent' | 'warning' | 'error' | 'success', string | RGBA>
export type PanelProps = {
  snapshot?: UsageSnapshot
  now: number
  expanded: boolean
  active?: boolean
  loading?: boolean
  toggle(): void
  refresh(): void
  colors: Colors
}

const percent = (value: number) => `${Math.round(value * 10) / 10}%`
const exactTime = (value: number) => new Date(value).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const planName = (plan?: string) => ({ prolite: 'Pro Lite', pro: 'Pro', plus: 'Plus', team: 'Team', business: 'Business', enterprise: 'Enterprise', free: 'Free' }[plan ?? ''] ?? plan)

export function UsagePanel(props: PanelProps) {
  const [width, setWidth] = createSignal(28)
  const usage = () => props.snapshot?.usage
  const stale = () => props.snapshot?.state === 'stale' || (props.snapshot?.updatedAt !== undefined && props.now - props.snapshot.updatedAt > 120000)
  const color = (used: number) => used >= 95 ? props.colors.error : used >= 80 ? props.colors.warning : props.colors.accent
  const Metrics = (p: { credits?: Usage['credits']; budget?: Usage['budget'] }) => <>
    <Show when={p.credits?.balance !== undefined}><text fg={props.colors.muted}>Credits: {p.credits!.balance}</text></Show>
    <Show when={p.credits?.unlimited !== undefined}><text fg={props.colors.muted}>Unlimited credits: {p.credits?.unlimited ? 'yes' : 'no'}</text></Show>
    <Show when={p.credits?.hasCredits !== undefined}><text fg={props.colors.muted}>Credits available: {p.credits?.hasCredits ? 'yes' : 'no'}</text></Show>
    <Show when={p.budget?.limit !== undefined}><text fg={props.colors.muted}>Budget: {p.budget!.limit} credits</text></Show>
    <Show when={p.budget?.used !== undefined}><text fg={props.colors.muted}>Spent: {p.budget!.used} credits</text></Show>
    <Show when={p.budget?.remainingPercent !== undefined}><text fg={props.colors.muted}>Budget: {percent(p.budget!.remainingPercent!)} remaining</text></Show>
    <Show when={p.budget?.resetAt !== undefined}><text fg={props.colors.muted}>Budget reset: {exactTime(p.budget!.resetAt!)}</text></Show>
  </>
  const Meter = (p: { window: UsageWindow }) => {
    const bar = () => progress(p.window.used, Math.max(1, Math.min(28, width())))
    return <box flexDirection="column" marginTop={1} flexShrink={0}>
      <text fg={props.colors.text}>{p.window.label}</text>
      <text fg={p.window.used >= 80 ? color(p.window.used) : props.colors.success}><b>{percent(100 - p.window.used)} remaining</b></text>
      <text wrapMode="none"><span style={{ fg: color(p.window.used) }}>{bar().filled}</span><span style={{ fg: props.colors.faint }}>{bar().empty}</span></text>
      <text fg={props.colors.muted}>{percent(p.window.used)} used</text>
      <text fg={props.colors.muted}>Reset: {remainingTime(p.window.resetAt, props.now)}</text>
      <Show when={props.expanded && p.window.resetAt !== undefined}><text fg={props.colors.muted}>{exactTime(p.window.resetAt!)}</text></Show>
    </box>
  }
  return <box flexDirection="column" flexShrink={0} marginTop={1} onSizeChange={function () { setWidth(this.width) }}>
    <text fg={props.colors.text}><b>Usage</b></text>
    <text fg={props.colors.text}><b>OpenAI</b><span style={{ fg: props.colors.accent }}>{props.active ? ' ●' : ''}</span></text>
    <text fg={props.colors.muted}>{[planName(usage()?.plan), 'via Codex'].filter(Boolean).join(' · ')}</text>
    <Show when={usage()} fallback={<text fg={props.colors.muted}>{props.loading ? 'Loading usage…' : 'No data available'}</text>}>
      <For each={usage()?.windows.filter(w => !w.extra)}>{window => <Meter window={window} />}</For>
      <Show when={usage()?.allowed === false || usage()?.limitReached === true}><text fg={props.colors.error}>Limit reached</text></Show>
      <Show when={props.expanded}>
        <For each={usage()?.windows.filter(w => w.extra)}>{window => <Meter window={window} />}</For>
        <box marginTop={1} flexDirection="column" flexShrink={0}>
          <Show when={props.snapshot?.account}><text fg={props.colors.muted}>{props.snapshot!.account}</text></Show>
          <Metrics credits={usage()?.credits} budget={usage()?.budget} />
          <For each={usage()?.buckets}>{bucket => <box flexDirection="column" flexShrink={0} marginTop={1}>
            <text fg={props.colors.text}>{bucket.label}</text>
            <Metrics credits={bucket.credits} budget={bucket.budget} />
          </box>}</For>
          <Show when={usage()?.allowed !== undefined}><text fg={props.colors.muted}>Requests allowed: {usage()?.allowed ? 'yes' : 'no'}</text></Show>
          <For each={usage()?.details}>{detail => <text fg={props.colors.muted}>{detail.label}: {detail.value}</text>}</For>
          <Show when={usage()?.resetCredits}><text fg={props.colors.muted}>Available resets: {usage()!.resetCredits!.available}</text>
            <For each={usage()?.resetCredits?.items}>{item => <text fg={props.colors.muted}>{item.title ?? 'Reset'} · {item.status ?? '—'}{item.expiresAt ? ` · expires ${exactTime(item.expiresAt)}` : ''}</text>}</For>
          </Show>
        </box>
      </Show>
      <text marginTop={1} fg={props.colors.accent} onMouseDown={props.toggle}>{props.expanded ? '▾ Hide details' : '▸ Account details'}</text>
    </Show>
    <Show when={stale()}><text fg={props.colors.warning}>Data is out of date</text></Show>
    <Show when={props.snapshot?.message}><text fg={props.colors.warning}>{props.snapshot!.message}</text></Show>
    <text marginTop={1} fg={props.colors.muted} onMouseDown={props.refresh}>{props.loading ? 'Refreshing…' : props.snapshot?.updatedAt === undefined ? '↻ Refresh' : `↻ ${Math.max(0, Math.floor((props.now - props.snapshot.updatedAt) / 60000))}m ago · every 60s`}</text>
  </box>
}
