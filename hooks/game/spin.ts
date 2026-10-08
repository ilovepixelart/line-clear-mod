import { ROWS, WIDTH } from './board'
import type { Board } from './board'
import type { Piece } from './pieces'
import type { Spin } from './rules'
import type { Point } from './types'

/** The four cells diagonal to a T's centre, its pointing side's two first, by rotation state. */
const CORNERS: Readonly<Record<number, readonly [Point, Point, Point, Point]>> = {
  0: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 2 }, { x: 2, y: 2 }],
  1: [{ x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 0 }, { x: 0, y: 2 }],
  2: [{ x: 0, y: 2 }, { x: 2, y: 2 }, { x: 0, y: 0 }, { x: 2, y: 0 }],
  3: [{ x: 0, y: 0 }, { x: 0, y: 2 }, { x: 2, y: 0 }, { x: 2, y: 2 }],
}

/** Whether a cell is taken: locked, or outside the walls and the floor. */
const isTaken = (board: Board, x: number, y: number) => x < 0 || x >= WIDTH || y < 0 || y >= ROWS || board[y]![x] !== null

/**
 * The spin a T locking at `piece` makes, by the three-corner rule, when its
 * last successful move was a turn whose kick moved it by `kick`: three of
 * the four cells diagonal to its centre taken makes a spin; with only one of
 * the two on its pointing side taken it is a mini, unless the kick moved it
 * one across and two up or down. Any other piece, or a last move that was
 * not a turn (`kick` null), makes none.
 */
export function spinOf(board: Board, piece: Piece, kick: Point | null): Spin {
  if (piece.kind !== 'T' || kick === null) {
    return 'none'
  }
  const taken = CORNERS[piece.rotation]!.map(({ x, y }) => isTaken(board, piece.x + x, piece.y + y))
  if (taken.filter(Boolean).length < 3) {
    return 'none'
  }
  const isFarKick = Math.abs(kick.x) === 1 && Math.abs(kick.y) === 2

  return (taken[0] && taken[1]) || isFarKick ? 'spin' : 'mini'
}
