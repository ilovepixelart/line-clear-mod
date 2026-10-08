import type { Kind } from './types'

/** The well is 10 columns wide. */
export const WIDTH = 10

/** Rows the person sees. */
export const VISIBLE_ROWS = 20

/** Rows above the visible ones, where pieces spawn: row 0 is the top hidden row. */
export const HIDDEN_ROWS = 4

/** Every row of the board, hidden ones first. */
export const ROWS = HIDDEN_ROWS + VISIBLE_ROWS

/** The locked cells, rows top to bottom, each cell the kind that locked there or null. */
export type Board = readonly (readonly (Kind | null)[])[]

const emptyRow = (): (Kind | null)[] => Array.from({ length: WIDTH }, () => null)

/** A board with nothing locked. */
export function emptyBoard(): Board {
  return Array.from({ length: ROWS }, emptyRow)
}

/** Whether a cell is inside the walls, the floor and the top hidden row, and not locked. */
export function isOpen(board: Board, x: number, y: number): boolean {
  return x >= 0 && x < WIDTH && y >= 0 && y < ROWS && board[y]![x] === null
}

/** The board with every full row removed and as many empty rows added on top. */
export function clearedRows(board: Board): { board: Board; cleared: number } {
  const kept = board.filter(row => row.some(cell => cell === null))
  const cleared = board.length - kept.length

  return { board: [...Array.from({ length: cleared }, emptyRow), ...kept], cleared }
}
