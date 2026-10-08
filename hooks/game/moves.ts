import { isOpen } from './board'
import type { Board } from './board'
import { kicksFor, pieceCells } from './pieces'
import type { Piece, Rotation } from './pieces'

/** Whether every cell of the piece is open on the board. */
export function fits(board: Board, piece: Piece): boolean {
  return pieceCells(piece).every(({ x, y }) => isOpen(board, x, y))
}

/** The piece moved by (dx, dy), or null where it would not fit. */
export function shifted(board: Board, piece: Piece, dx: number, dy: number): Piece | null {
  const moved = { ...piece, x: piece.x + dx, y: piece.y + dy }

  return fits(board, moved) ? moved : null
}

/** How many rows the piece can fall before it rests. */
export function dropDistance(board: Board, piece: Piece): number {
  let rows = 0
  while (fits(board, { ...piece, y: piece.y + rows + 1 })) {
    rows += 1
  }

  return rows
}

/** The piece turned a quarter (1 clockwise, -1 counterclockwise) at the first kick that fits, or null. */
export function rotated(board: Board, piece: Piece, direction: 1 | -1): Piece | null {
  const rotation = ((piece.rotation + direction + 4) % 4) as Rotation
  for (const kick of kicksFor(piece.kind, piece.rotation, rotation)) {
    const turned = { ...piece, rotation, x: piece.x + kick.x, y: piece.y + kick.y }
    if (fits(board, turned)) {
      return turned
    }
  }

  return null
}

/** The board with the piece's cells locked as its kind. */
export function placed(board: Board, piece: Piece): Board {
  const rows = board.map(row => [...row])
  for (const { x, y } of pieceCells(piece)) {
    rows[y]![x] = piece.kind
  }

  return rows
}
