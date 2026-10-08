import Game from '../../hooks/game'
import type { Board, GameState, Input, Kind } from '../../hooks/game'

/**
 * A new game at time 0 whose falling piece is `kind`, fresh at its spawn
 * position, on `board` (empty by default). The queue stays the seed's.
 */
export function gameWith(kind: Kind, board: Board = Game.emptyBoard(), extra: Partial<GameState> = {}): GameState {
  const fresh = Game.newGame(1, { startLevel: extra.startLevel ?? 1 })
  const active = Game.spawnPiece(kind)

  return { ...fresh, board, active, lowestY: Math.max(...Game.pieceCells(active).map(({ y }) => y)), ...extra }
}

/** Steps through inputs, all at one time. */
export function play(state: GameState, inputs: readonly Input[], nowMs = 0): GameState {
  return inputs.reduce((current, input) => Game.step(current, input, nowMs), state)
}

/** Steps n of the same input at one time. */
export const times = (n: number, input: Input): Input[] => Array.from({ length: n }, () => input)

/** Freezes a state all the way down, so a step that writes into it throws. */
export function deepFrozen<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const inner of Object.values(value)) {
      deepFrozen(inner)
    }
    Object.freeze(value)
  }

  return value
}
