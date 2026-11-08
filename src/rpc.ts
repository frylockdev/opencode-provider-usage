import { Rpc } from '@opencode/plugin/rpc'

export const OpenAIUsage = Rpc.define({
  id: 'openai-usage',
  events: {},
  methods: { get: {
    input: { type: 'object', additionalProperties: false },
    output: { type: 'object', required: ['state', 'checkedAt'], properties: {
      state: { enum: ['ready', 'stale', 'unavailable'] }, checkedAt: { type: 'number' },
      account: { type: 'string' }, usage: { type: 'object' }, updatedAt: { type: 'number' },
      retryAt: { type: 'number' }, message: { type: 'string' },
    }, additionalProperties: false },
  } },
})
