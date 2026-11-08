# OpenAI Usage for OpenCode

A compact OpenAI subscription usage panel in the **OpenCode V2** sidebar.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![OpenCode](https://img.shields.io/badge/OpenCode-2.2.6-8b5cf6)](https://opencode.ai)

```text
Usage
OpenAI ●
Pro Lite · via Codex

Weekly
73% remaining
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
27% used
Reset: 2d 5h

▸ Account details
↻ 0m ago · every 60s
```

Example values are illustrative. In the terminal, the used portion of the bar is highlighted in color.

- Used and remaining percentages, a colored progress bar, and reset countdowns.
- Main usage windows at a glance; expand for additional quotas, account details, credits, budgets, and available resets.
- Colors follow your theme, with a warning at 80% usage and an error color at 95%.
- Refreshes every minute while visible; clearly marks stale data after an error.

## Installation

Tested with OpenCode **2.2.6** and Codex CLI **0.166.0** on macOS.

1. Install [OpenCode](https://opencode.ai) and [Codex CLI](https://developers.openai.com/codex/cli).
2. Sign in to your desired ChatGPT account through Codex:

```sh
codex login
codex login status
```

3. Install the plugin globally from GitHub:

```sh
opencode plugin add 'github:frylockdev/opencode-provider-usage#v0.1.4'
```

OpenCode picks up the configuration automatically. If the panel does not appear, run `/reload`.
Open a session with the right sidebar visible. `codex` must be available in the PATH of the OpenCode
**server** process. With a remote server, the plugin uses that server's Codex installation and account.

### Local development

```sh
git clone https://github.com/frylockdev/opencode-provider-usage.git
cd opencode-provider-usage
npm ci
npm exec --yes --package=bun -- bun run build:tui
```

To use the source checkout, add its absolute path to `~/.config/opencode/opencode.json`:

```json
{
  "plugins": ["/absolute/path/to/opencode-provider-usage"]
}
```

Keep only one plugin entry: the GitHub package or the local directory.
Rebuild after changing the interface. `dist/tui.js` is included in the GitHub release, so users do not
need a separate Bun installation. The OpenTUI loader does not compile TSX inside `node_modules`.
The command is named `build:tui` to avoid unnecessary npm Git dependency preparation during installation.

## Controls

- Click **Account details** to expand, or **Hide details** to collapse.
- Use `/usage` or Ctrl+P → **OpenAI Usage: Toggle details** for the same action from the keyboard.
- Click the **↻** line or use Ctrl+P → **OpenAI Usage: Refresh** to refresh.
- Manual refresh respects the one-minute cache and rate-limit cooldown.

## Data source and limitations

Data comes from the official local `codex app-server`, using only `account/read` and
`account/rateLimits/read`. The plugin does not start model turns or read token files.
Codex manages authentication and token refresh.

**The panel shows the account selected in Codex**, which may differ from your OpenCode account.
Its email and workspace appear in the expanded details; the source label "via Codex" is always visible.
Select the same account in both applications to monitor the subscription you use in OpenCode.
Account changes are detected on the next refresh (within 60 seconds).

OpenCode's current ChatGPT token-sharing login does not provide a usage API:
direct `wham/usage` requests return HTTP 401. See [openai/codex#54219](https://github.com/openai/codex/issues/54219).
The plugin therefore uses a separate Codex login to read usage limits.

Only fields returned by Codex are shown. Missing data does not mean 0% usage.
Credits are not displayed as dollars. Dates use English formatting and the terminal's local time zone.
Available resets are read-only; the plugin never spends them.

If the account cannot be identified, previous metrics are cleared. A temporary failure after identifying
the same account preserves the last result with a stale-data notice.
Requests time out after 15 seconds. Codex RPC does not expose HTTP Retry-After, so the plugin waits
five minutes after a rate-limit error. Polling stops when the panel is hidden.

## Verification

```sh
npm test
npm run typecheck
npm exec --yes --package=bun -- bun run build:tui
npm exec --yes --package=bun -- bun run test:tui
opencode plugin list
opencode api post /api/rpc/openai-usage/get --data '{"input":{}}'
```

The last command prints usage metrics and the account label, without credentials.
Renderer tests use Bun, as required by OpenTUI. The plugin itself runs in OpenCode's runtime.

## Uninstall

```sh
opencode plugin remove 'github:frylockdev/opencode-provider-usage#v0.1.4'
```

For a local installation, remove the plugin's path from the global `plugins` list.

## License

[MIT](LICENSE). An independent plugin, not an official OpenAI or OpenCode product.
