import { describe, expect, test, tier } from 'claude-code/testing'

import Game from '../../hooks/game'
import { bottomRows } from '../fixtures/board'
import { gameWith, play, times } from '../fixtures/game'

tier('user')

describe('pause', () => {
  test('a paused game ignores ticks: gravity is frozen', () => {
    const paused = Game.step(gameWith('O'), 'pause', 500)
    expect(Game.phaseOf(paused)).toBe('paused')
    expect(Game.step(paused, 'tick', 60_000)).toBe(paused)
  })

  test('a paused game ignores every other input', () => {
    const paused = Game.step(gameWith('O'), 'pause', 500)
    for (const input of ['left', 'right', 'rotateCw', 'rotateCcw', 'softDrop', 'hardDrop', 'hold'] as const) {
      expect(Game.step(paused, input, 600)).toBe(paused)
    }
    expect(Game.holdOf(paused).canHold).toBe(false)
  })

  test('after a resume gravity counts only the time played: 500 ms before, 500 ms after', () => {
    const resumed = play(Game.step(gameWith('O'), 'pause', 500), ['pause'], 10_500)
    expect(Game.phaseOf(resumed)).toBe('playing')
    expect(Game.step(resumed, 'tick', 10_999).active!.y).toBe(2)
    expect(Game.step(resumed, 'tick', 11_000).active!.y).toBe(3)
  })

  test('the lock delay is frozen too: 300 ms before the pause and 200 ms after it lock the piece', () => {
    const resting = play(gameWith('O'), times(20, 'softDrop'))
    const resumed = play(Game.step(resting, 'pause', 300), ['pause'], 5300)
    expect(bottomRows(Game.step(resumed, 'tick', 5499).board, 1)).toEqual(['..........'])
    expect(bottomRows(Game.step(resumed, 'tick', 5500).board, 1)).toEqual(['....##....'])
  })

  test('pausing first lets the time already passed act: a row due at 1000 ms has fallen', () => {
    expect(Game.step(gameWith('O'), 'pause', 1000).active!.y).toBe(3)
  })
})
