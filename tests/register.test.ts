import { describe, expect, test, tier } from 'claude-code/testing'

import { SESSION, inSession } from './fixtures/pane'

tier('user')

const TURN = { text: 'write a story', turnId: 't1' }

describe('purely a pane', () => {
  test('a tool check gets the decision beneath it', async ($, on) => {
    inSession(on)
    on('tool.check', () => ({ decision: 'ask', reason: 'beneath' }))

    expect(await $.tool.check({ tool: 'Bash', input: { command: 'ls' } })).toEqual({ decision: 'ask', reason: 'beneath' })
  })

  test('a submitted prompt reaches the engine as typed', async ($, on) => {
    inSession(on)
    const seen: string[] = []
    on('prompt.submit', (_$, e) => {
      seen.push(e.text)

      return { text: e.text }
    })

    expect(await $.prompt.submit({ text: 'hello', wait: false, origin: { kind: 'composer' } })).toEqual({ text: 'hello' })
    expect(seen).toEqual(['hello'])
  })

  test('a turn starts as the engine starts it and opens nothing', async ($, on) => {
    const { opened } = inSession(on)
    on('turn.start', (_$, e) => ({ turnId: e.turnId }))
    await $.session.start(SESSION)

    expect(await $.turn.start(TURN)).toEqual({ turnId: 't1' })
    expect(opened).toEqual([])
  })
})
