import Game from '../../hooks/game'
import type { Board, Kind, Point } from '../../hooks/game'

/**
 * A board drawn as rows, the last string the bottom row: `#` a locked cell
 * (kind Z, the kind does not matter to these tests), `.` empty. Rows above the
 * drawing are empty, hidden ones included.
 */
export function boardFrom(...rows: string[]): Board {
  const empty = Array.from({ length: Game.ROWS - rows.length }, () => Array.from({ length: Game.WIDTH }, () => null))
  const drawn = rows.map(row => {
    if (row.length !== Game.WIDTH) {
      throw new Error(`a drawn row is ${Game.WIDTH} wide: "${row}"`)
    }

    return [...row].map((char): Kind | null => (char === '#' ? 'Z' : null))
  })

  return [...empty, ...drawn]
}

/** A board with every cell locked except the given ones. */
export function boardWithHoles(holes: readonly Point[]): Board {
  const open = new Set(holes.map(({ x, y }) => `${x},${y}`))

  return Array.from({ length: Game.ROWS }, (_, y) =>
    Array.from({ length: Game.WIDTH }, (_, x): Kind | null => (open.has(`${x},${y}`) ? null : 'Z')),
  )
}

/** The board's rows drawn back as strings, `#` locked, `.` empty: the last `count` rows. */
export function bottomRows(board: Board, count: number): string[] {
  return board.slice(board.length - count).map(row => row.map(cell => (cell === null ? '.' : '#')).join(''))
}

/** Cells as "x,y" strings in a stable order, so shapes compare as sets. */
export const keysOf = (cells: readonly Point[]) => cells.map(({ x, y }) => `${x},${y}`).sort()

/** How many cells of a board are locked. */
export const lockedCount = (board: Board) => board.flat().filter(cell => cell !== null).length
