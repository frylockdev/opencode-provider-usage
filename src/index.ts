import { Plugin } from '@opencode/plugin'
import { OpenAIUsage } from './rpc.ts'
import { createUsageService } from './service.ts'
import { readCodexUsage } from './codex.ts'

// One cache per server process, shared by panels across projects.
const service = createUsageService({ read: readCodexUsage })

export default Plugin.define({
  id: 'openai-usage',
  async setup(context) {
    await context.rpc.register(OpenAIUsage, { get: () => service.get() })
  },
})
