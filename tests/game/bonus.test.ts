import { describe, expect, test, tier } from 'claude-code/testing'

import Game from '../../hooks/game'
import type { GameState, Piece } from '../../hooks/game'
import { boardFrom } from '../fixtures/board'
import { gameWith, play, times } from '../fixtures/game'

tier('user')

/**
 * Back to back and combos, from the recent scoring table on the community
 * wiki: a difficult clear (four rows at once, or any spin that clears rows)
 * right after another difficult clear scores half again; a single, double
 * or triple breaks that run, a lock that clears nothing does not. Each lock
 * that clears rows right after another adds 50 times the run's count times
 * the level: the second in a row is combo 1.
 */

const nineWide = (rows: number) => boardFrom(...Array.from({ length: rows }, () => '#########.'))
/** The I stood up and taken to the open column 9, then dropped. */
const intoColumn9 = ['rotateCw', ...times(4, 'right'), 'hardDrop'] as const

/** An I over `rows` rows open in column 9, at time 0, with `extra` state. */
const iOver = (rows: number, extra: Partial<GameState> = {}) => gameWith('I', nineWide(rows), extra)

/** The spin double slot from the spin tests, and the T above its mouth. */
const doubleSlot = boardFrom('####......', '###...####', '####.#####')
const aboveSlot: Piece = { kind: 'T', rotation: 1, x: 3, y: 19 }
const spinDouble = (extra: Partial<GameState> = {}) => play(gameWith('T', doubleSlot, { active: aboveSlot, lowestY: 21, ...extra }), ['rotateCw', 'hardDrop'])

describe('back to back', () => {
  test('two fours in a row: the second scores half again, 1200', () => {
    // eight rows open in column 9; the second I comes back from hold once the first clear is done
    const first = play(iOver(8, { hold: 'I' }), intoColumn9)
    expect(first.lastAction).toMatchObject({ rows: 4, points: 800, backToBack: false })
    const second = play(Game.step(first, 'tick', Game.CLEAR_MS), ['hold', ...intoColumn9], Game.CLEAR_MS)
    expect(second.lastAction).toMatchObject({ rows: 4, points: 1200, backToBack: true })
    expect(Game.linesOf(second)).toBe(8)
  })

  test('a four after a difficult clear scores 1200; with none before it, 800', () => {
    expect(play(iOver(4, { backToBack: true }), intoColumn9).lastAction?.points).toBe(1200)
    expect(play(iOver(4), intoColumn9).lastAction?.points).toBe(800)
  })

  test('a spin double after a difficult clear scores half again: 1800', () => {
    expect(spinDouble({ backToBack: true }).lastAction).toMatchObject({ points: 1800, backToBack: true })
    expect(spinDouble().lastAction).toMatchObject({ points: 1200, backToBack: false })
  })

  test('a single, double or triple breaks the run and gets nothing extra', () => {
    for (const rows of [1, 2, 3]) {
      const locked = play(iOver(rows, { backToBack: true }), intoColumn9)
      expect(locked.lastAction?.points, `${rows}`).toBe([0, 100, 300, 500][rows])
      expect(locked.backToBack, `${rows}`).toBe(false)
    }
  })

  test('a lock that clears nothing keeps the run going', () => {
    expect(play(gameWith('O', undefined, { backToBack: true }), ['hardDrop']).backToBack).toBe(true)
  })

  test('a spin that clears nothing is no clear: no half again, and the run goes on', () => {
    const open = boardFrom('####......', '###...###.', '####.####.')
    const locked = play(gameWith('T', open, { active: aboveSlot, lowestY: 21, backToBack: true }), ['rotateCw', 'hardDrop'])
    expect(locked.lastAction).toMatchObject({ rows: 0, spin: 'spin', points: 400, backToBack: false })
    expect(locked.backToBack).toBe(true)
  })

  test('a difficult clear starts the run', () => {
    expect(play(iOver(4), intoColumn9).backToBack).toBe(true)
    expect(spinDouble().backToBack).toBe(true)
  })
})
