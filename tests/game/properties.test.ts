import { describe, expect, test, tier } from 'claude-code/testing'

import Game from '../../hooks/game'
import type { Board, GameState, Input } from '../../hooks/game'
import { lockedCount } from '../fixtures/board'

tier('user')

const INPUTS: Input[] = ['tick', 'tick', 'tick', 'left', 'right', 'softDrop', 'hardDrop', 'rotateCw', 'rotateCcw', 'hold', 'pause']

/** A tiny linear congruential generator, independent of the engine's, for choosing inputs. */
function chooser(seed: number) {
  let state = seed >>> 0

  return (n: number) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0

    return state % n
  }
}

/** Rows filled except one random column up to 8 rows below the top of the well: a well for random drops to fill. */
function holedRows(board: Board, pick: (n: number) => number): Board {
  const hole = pick(Game.WIDTH)
  const filled = Game.VISIBLE_ROWS - 8

  return board.map((row, y) => (y < Game.ROWS - filled ? row : row.map((_, x) => (x === hole ? null : 'Z'))))
}

type Run = { states: GameState[]; inputs: [Input, number][] }

/** A game from `seed` driven by `steps` random inputs at random gaps of 0 to 400 ms. */
function randomRun(seed: number, steps: number): Run {
  const pick = chooser(seed * 7919 + 1)
  let state = Game.newGame(seed, { startLevel: 1 + pick(8) })
  if (seed % 2 === 1) {
    // odd seeds start over a well, so random drops clear rows
    state = { ...state, board: holedRows(state.board, pick) }
  }
  let now = 0
  const states = [state]
  const inputs: [Input, number][] = []
  for (let i = 0; i < steps; i++) {
    now += pick(401)
    const input = INPUTS[pick(INPUTS.length)]!
    inputs.push([input, now])
    state = Game.step(state, input, now)
    states.push(state)
  }

  return { states, inputs }
}

const GAMES = 150
const STEPS = 300
let cache: { runs: Run[]; everyState: Labelled[]; everyStep: LabelledStep[] } | undefined

type Labelled = { state: GameState; at: string }
type LabelledStep = { before: GameState; after: GameState; at: string }

/**
 * The random games, played on first use so an engine that throws fails the
 * properties instead of the file's load: every run, every state and every
 * pair of consecutive states, labelled for a failure message.
 */
function played() {
  if (cache === undefined) {
    const runs = Array.from({ length: GAMES }, (_, seed) => randomRun(seed, STEPS))
    cache = {
      runs,
      everyState: runs.flatMap(({ states }, seed) => states.map((state, i) => ({ state, at: `seed ${seed} step ${i}` }))),
      everyStep: runs.flatMap(({ states }, seed) =>
        states.slice(1).map((after, i) => ({ before: states[i]!, after, at: `seed ${seed} step ${i + 1}` })),
      ),
    }
  }

  return cache
}

const cellsOf = (state: GameState) => (state.active === null ? [] : Game.pieceCells(state.active))

describe('properties over random play', () => {
  test('the falling piece never has a cell outside the board', () => {
    const outside = played().everyState.filter(({ state }) =>
      cellsOf(state).some(({ x, y }) => x < 0 || x >= Game.WIDTH || y < 0 || y >= Game.ROWS),
    )
    expect(outside.map(({ at }) => at)).toEqual([])
  })

  test('the falling piece never overlaps a locked cell', () => {
    const overlapping = played().everyState.filter(({ state }) => cellsOf(state).some(({ x, y }) => state.board[y]?.[x] !== null))
    expect(overlapping.map(({ at }) => at)).toEqual([])
  })

  test('locked cells only arrive four at a time and only leave ten per cleared row', () => {
    // gaps between steps stay under the 500 ms lock delay, so a step locks at most two
    // pieces: one as time passes, one by its input
    const broken = played().everyStep.filter(({ before, after }) => {
      const added = lockedCount(after.board) - lockedCount(before.board)
      const removed = 10 * (after.lines - before.lines)

      return ![0, 4, 8].includes(added + removed)
    })
    expect(broken.map(({ at }) => at)).toEqual([])
  })

  test('the board keeps its size and every row its width', () => {
    const misshapen = played().everyState.filter(
      ({ state }) =>
        state.board.length !== Game.ROWS ||
        state.board.some(row => row.length !== Game.WIDTH) ||
        Game.boardOf(state).length !== Game.VISIBLE_ROWS,
    )
    expect(misshapen.map(({ at }) => at)).toEqual([])
  })

  test('score and lines never go down, and the level follows the lines', () => {
    const broken = played().everyStep.filter(
      ({ before, after }) =>
        after.score < before.score ||
        after.lines < before.lines ||
        after.level !== after.startLevel + Math.floor(after.lines / 10),
    )
    expect(broken.map(({ at }) => at)).toEqual([])
  })

  test('the ghost rests on the stack and overlaps nothing', () => {
    const broken = played().everyState.filter(({ state }) => {
      if (state.active === null) {
        return false
      }
      const overlaps = Game.ghostOf(state).some(({ x, y }) => state.board[y + Game.HIDDEN_ROWS]![x] !== null)
      const lower = { ...state.active, y: state.active.y + Game.dropDistance(state.board, state.active) + 1 }

      return overlaps || Game.fits(state.board, lower)
    })
    expect(broken.map(({ at }) => at)).toEqual([])
  })

  test('random play clears rows, so the clearing properties are exercised', () => {
    const { runs } = played()
    const cleared = runs.reduce((sum, { states }) => sum + states[states.length - 1]!.lines, 0)
    expect(cleared).toBeGreaterThan(10)
  })

  test('a game that is over stays over', () => {
    let ended = 0
    for (const { states } of played().runs) {
      const first = states.findIndex(state => state.phase === 'over')
      if (first !== -1) {
        ended += 1
        expect(states.slice(first).every(state => state === states[first])).toBe(true)
      }
    }
    expect(ended, 'some random games reach game over, so this property is exercised').toBeGreaterThan(0)
  })

  test('replaying the same seed and inputs gives the same game', () => {
    played().runs.slice(0, 20).forEach(({ states, inputs }) => {
      let replay = states[0]!
      for (const [input, now] of inputs) {
        replay = Game.step(replay, input, now)
      }
      expect(replay).toEqual(states[states.length - 1])
    })
  })
})
