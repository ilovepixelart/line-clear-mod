import { describe, expect, test, tier } from 'claude-code/testing'

import Game from '../../hooks/game'
import type { Board, GameState } from '../../hooks/game'
import { boardFrom, bottomRows } from '../fixtures/board'
import { gameWith, play, times } from '../fixtures/game'

tier('user')

/** Columns 3 to 6 filled from row 2 (hidden) to the floor: every kind's spawn cells are taken. */
const spawnBlocked: Board = Game.emptyBoard().map((row, y) => row.map((cell, x) => (y >= 2 && x >= 3 && x <= 6 ? 'Z' : cell)))
/** Columns 0 and 1 filled up to the top visible row (row 4). */
const towerToTop = boardFrom(...times(20, 'tick').map(() => '##........'))
/** Columns 0 and 1 filled up to row 5, one below the top visible row. */
const towerBelowTop = boardFrom(...times(19, 'tick').map(() => '##........'))

/** An O in columns 8 and 9 at the spawn rows, clear of the spawn area. */
const oAtRight = (board: Board) => gameWith('O', board, { active: { kind: 'O', rotation: 0, x: 7, y: 2 } })

const isOver = (state: GameState, reason: 'block-out' | 'lock-out') => {
  expect(Game.phaseOf(state)).toBe('over')
  expect(state.over).toBe(reason)
  expect(state.active).toBe(null)
}

describe('game over', () => {
  test('block out: the next piece has no room to enter', () => {
    const over = play(oAtRight(spawnBlocked), ['hardDrop'])
    isOver(over, 'block-out')
    expect(bottomRows(over.board, 2), 'the O that was dropped stays locked').toEqual(['...####.##', '...####.##'])
    expect(Game.scoreOf(over), 'the drop still scores').toBe(40)
  })

  test('block out: a hold whose piece has no room to enter', () => {
    isOver(play(oAtRight(spawnBlocked), ['hold']), 'block-out')
  })

  test('lock out: a piece locks with every cell above the visible rows', () => {
    // the O slides onto the tower in rows 2 and 3, both hidden
    const over = play(gameWith('O', towerToTop), ['left', 'left', 'left', 'hardDrop'])
    isOver(over, 'lock-out')
    expect(over.board[2]!.slice(0, 3)).toEqual([null, 'O', 'O'])
  })

  test('lock out also happens when the lock delay runs out', () => {
    const resting = play(gameWith('O', towerToTop), ['left', 'left', 'left'])
    expect(Game.phaseOf(Game.step(resting, 'tick', 499))).toBe('playing')
    isOver(Game.step(resting, 'tick', 500), 'lock-out')
  })

  test('a piece with one cell in the visible rows is not a lock out', () => {
    const game = play(gameWith('O', towerBelowTop), ['left', 'left', 'left', 'softDrop', 'hardDrop'])
    expect(Game.phaseOf(game)).toBe('playing')
    expect(game.board[4]!.slice(0, 3)).toEqual([null, 'O', 'O'])
  })

  test('once over, every input and tick leaves the game as it is', () => {
    const over = play(oAtRight(spawnBlocked), ['hardDrop'])
    for (const input of ['tick', 'left', 'right', 'rotateCw', 'rotateCcw', 'softDrop', 'hardDrop', 'hold', 'pause'] as const) {
      expect(Game.step(over, input, 99999)).toBe(over)
    }
    expect(Game.holdOf(over).canHold).toBe(false)
    expect(Game.ghostOf(over)).toEqual([])
  })
})
