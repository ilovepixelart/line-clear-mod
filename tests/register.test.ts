import { describe, expect, test, tier } from 'claude-code/testing'

tier('user')

describe('register', () => {
  test('the engine-only module intercepts nothing: a tool check gets the decision beneath it', async ($, on) => {
    on('tool.check', () => ({ decision: 'ask', reason: 'beneath' }))

    expect(await $.tool.check({ tool: 'Bash', input: { command: 'ls' } })).toEqual({ decision: 'ask', reason: 'beneath' })
  })
})
