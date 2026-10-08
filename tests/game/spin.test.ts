import { describe, expect, test, tier } from 'claude-code/testing'

import Game from '../../hooks/game'
import type { Board, GameState, Piece } from '../../hooks/game'
import { boardFrom } from '../fixtures/board'
import { gameWith, play } from '../fixtures/game'

tier('user')

/**
 * Spins by the three-corner rule (harddrop.com/wiki/T-Spin): the T locks
 * with its last successful move a turn, and three of the four cells
 * diagonal to its centre taken (the walls and the floor count as taken).
 * Both corners on its pointing side taken: a spin; one of them: a mini,
 * unless the turn's kick moved it 1 across and 2 down or up, which makes a
 * spin. Points (the recent scoring table on the community wiki): mini 100,
 * mini single 200, mini double 400; spin 400, spin single 800, spin double
 * 1200, spin triple 1600; all times the level.
 */

/** A game whose falling piece is `active`, on `board`, at time 0. */
function withT(board: Board, active: Piece, level = 1): GameState {
  const lowestY = Math.max(...Game.pieceCells(active).map(({ y }) => y))

  return gameWith('T', board, { active, lowestY, level, startLevel: level })
}

/**
 * A slot for the T pointing down in columns 3 to 5, rows 20 and 21, with an
 * overhang at column 3 of row 19: a spin double once the T turns into it.
 */
const doubleSlot = boardFrom('####......', '###...####', '####.#####')
/** The T pointing right above the slot's mouth, one turn clockwise from its place in the slot. */
const aboveSlot: Piece = { kind: 'T', rotation: 1, x: 3, y: 19 }

/** Rows 20 and 21 with row 21 full but column 0: the T pointing right against the left wall fills it. */
const wallFloor = boardFrom('..........', '.#########')

describe('spins: the three-corner rule', () => {
  test('a T turned into a slot with both pointing-side corners taken is a spin: spin double, 1200', () => {
    const locked = play(withT(doubleSlot, aboveSlot), ['rotateCw', 'hardDrop'])
    expect(Game.linesOf(locked)).toBe(2)
    expect(Game.scoreOf(locked)).toBe(1200)
    expect(locked.lastAction).toMatchObject({ rows: 2, spin: 'spin' })
  })

  test('the same lock scores times the level: at level 3, 3600', () => {
    expect(Game.scoreOf(play(withT(doubleSlot, aboveSlot, 3), ['rotateCw', 'hardDrop']))).toBe(3600)
  })

  test('a spin that clears nothing still scores: 400', () => {
    // the slot without its right column: rows 20 and 21 stay one short
    const open = boardFrom('####......', '###...###.', '####.####.')
    const locked = play(withT(open, aboveSlot), ['rotateCw', 'hardDrop'])
    expect(Game.linesOf(locked)).toBe(0)
    expect(Game.scoreOf(locked)).toBe(400)
    expect(locked.lastAction).toMatchObject({ rows: 0, spin: 'spin' })
  })

  test('one pointing-side corner taken, the other two by the wall: a mini single, 200', () => {
    // the T turns clockwise from flat at column 0, kicks one left against the wall, pointing right
    const locked = play(withT(wallFloor, { kind: 'T', rotation: 0, x: 0, y: 19 }), ['rotateCw', 'hardDrop'])
    expect(Game.linesOf(locked)).toBe(1)
    expect(Game.scoreOf(locked)).toBe(200)
    expect(locked.lastAction).toMatchObject({ rows: 1, spin: 'mini' })
  })

  test('a turn whose kick moves the T one across and two down makes a spin even where the corners say mini: 400', () => {
    // found by search and checked by hand: pointing down at column 1, row 17, the T turns
    // clockwise with the fifth kick (+1, +2) to point left at column 2, row 19; of its corners
    // only the pointing side's lower one is taken, and both on the other side
    const board = boardFrom('#.###...##', '....####.#', '.#..###.##', '#.....##..', '.##.#.##.#')
    const locked = play(withT(board, { kind: 'T', rotation: 2, x: 1, y: 17 }), ['rotateCw', 'hardDrop'])
    expect(Game.linesOf(locked)).toBe(0)
    expect(locked.board[19]!.slice(0, 4)).toEqual([null, 'Z', null, 'T'])
    expect(Game.scoreOf(locked)).toBe(400)
    expect(locked.lastAction).toMatchObject({ rows: 0, spin: 'spin' })
  })

  test('two corners taken are not enough: the slot without its overhang is a plain double, 300', () => {
    const noOverhang = boardFrom('..........', '###...####', '####.#####')
    const locked = play(withT(noOverhang, aboveSlot), ['rotateCw', 'hardDrop'])
    expect(Game.linesOf(locked)).toBe(2)
    expect(Game.scoreOf(locked)).toBe(300)
    expect(locked.lastAction).toMatchObject({ rows: 2, spin: 'none' })
  })

  test('a turn in the air and a hard drop into three taken corners is no spin: the drop was the last move', () => {
    // pointing right, it falls down column 1 with its nub over column 2 onto the cell at column 2, row 21
    const shaft = boardFrom('#.........', '#.........', '#.#.......')
    const locked = play(withT(shaft, { kind: 'T', rotation: 0, x: 0, y: 10 }), ['rotateCw', 'hardDrop'])
    expect(locked.board[21]!.slice(0, 3)).toEqual(['Z', 'T', 'Z'])
    // 9 rows of hard drop, 2 points each, and nothing for the lock
    expect(Game.scoreOf(locked)).toBe(18)
    expect(locked.lastAction).toMatchObject({ rows: 0, spin: 'none' })
  })

  test('the same place reached by a move, not a turn, is no spin: a plain single, 100', () => {
    // turned in the air, moved left to the wall and dropped a row: the last move was not a turn
    const start = withT(wallFloor, { kind: 'T', rotation: 0, x: 0, y: 18 })
    const locked = play(start, ['rotateCw', 'left', 'softDrop', 'hardDrop'])
    expect(Game.linesOf(locked)).toBe(1)
    // 100 for the single and 1 for the soft drop
    expect(Game.scoreOf(locked)).toBe(101)
    expect(locked.lastAction).toMatchObject({ rows: 1, spin: 'none' })
  })

  test('only a T spins: a J turned into the same place against the wall is a plain single, 100', () => {
    const locked = play(gameWith('J', wallFloor, { active: { kind: 'J', rotation: 0, x: 0, y: 19 }, lowestY: 20 }), ['rotateCw', 'hardDrop'])
    expect(Game.linesOf(locked)).toBe(1)
    expect(Game.scoreOf(locked)).toBe(100)
    expect(locked.lastAction).toMatchObject({ rows: 1, spin: 'none' })
  })

  test('a lock that clears nothing and is no spin is no action to call out', () => {
    expect(play(gameWith('O'), ['hardDrop']).lastAction).toMatchObject({ rows: 0, spin: 'none' })
    expect(Game.newGame(1).lastAction).toBeNull()
  })
})
