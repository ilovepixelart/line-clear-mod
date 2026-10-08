import { describe, expect, test, tier } from 'claude-code/testing'

import Game from '../../hooks/game'
import type { Kind, Piece, Point, Rotation } from '../../hooks/game'
import { boardFrom, boardWithHoles, bottomRows } from '../fixtures/board'

tier('user')

const BOTTOM = Game.ROWS - 1
const EMPTY = boardFrom()
const piece = (kind: Kind, rotation: Rotation, x: number, y: number): Piece => ({ kind, rotation, x, y })
const where = (moved: Piece | null) => moved && { rotation: moved.rotation, x: moved.x, y: moved.y }

/** A board full except the piece's own cells and the cells of where it should end up. */
const pocketFor = (start: Piece, end: Piece) => boardWithHoles([...Game.pieceCells(start), ...Game.pieceCells(end)])

describe('fits', () => {
  test('a piece fits on an empty board inside the walls', () => {
    expect(Game.fits(EMPTY, piece('T', 0, 0, 0))).toBe(true)
    expect(Game.fits(EMPTY, piece('T', 0, 7, BOTTOM - 1))).toBe(true)
  })

  test('a cell past the left wall, the right wall, the floor or the top does not fit', () => {
    expect(Game.fits(EMPTY, piece('T', 0, -1, 5)), 'column -1').toBe(false)
    expect(Game.fits(EMPTY, piece('T', 0, 8, 5)), 'column 10').toBe(false)
    expect(Game.fits(EMPTY, piece('T', 0, 3, BOTTOM)), 'one row below the floor').toBe(false)
    expect(Game.fits(EMPTY, piece('T', 0, 3, -1)), 'one row above the top').toBe(false)
  })

  test('an empty box column past the wall is fine: only cells count', () => {
    // T state 1 fills box columns 1 and 2: its box may start at column -1
    expect(Game.fits(EMPTY, piece('T', 1, -1, 5))).toBe(true)
  })

  test('a cell on a locked cell does not fit, one beside it does', () => {
    const board = boardFrom('....#.....')
    expect(Game.fits(board, piece('O', 0, 3, BOTTOM - 1)), 'the square covers column 4').toBe(false)
    expect(Game.fits(board, piece('O', 0, 4, BOTTOM - 1)), 'columns 5 and 6 are free').toBe(true)
  })
})

describe('shifting and dropping', () => {
  test('a shift that fits moves the piece, one that does not returns null', () => {
    expect(where(Game.shifted(EMPTY, piece('O', 0, 3, 10), -1, 0))).toEqual({ rotation: 0, x: 2, y: 10 })
    // O fills box columns 1 and 2: at box x -1 it touches the left wall
    expect(Game.shifted(EMPTY, piece('O', 0, -1, 10), -1, 0)).toBe(null)
    expect(Game.shifted(EMPTY, piece('O', 0, 7, 10), 1, 0)).toBe(null)
  })

  test('drop distance counts the empty rows under the piece', () => {
    expect(Game.dropDistance(EMPTY, piece('O', 0, 3, 2)), 'rows 2 and 3 down to rows 22 and 23').toBe(20)
    expect(Game.dropDistance(boardFrom('....#.....', '....#.....'), piece('O', 0, 3, 2))).toBe(18)
    expect(Game.dropDistance(EMPTY, piece('O', 0, 3, BOTTOM - 1)), 'already on the floor').toBe(0)
  })
})

describe('rotation with kicks: J L S T Z', () => {
  test('in open space the turn needs no kick, clockwise and counterclockwise', () => {
    expect(where(Game.rotated(EMPTY, piece('T', 0, 3, 10), 1))).toEqual({ rotation: 1, x: 3, y: 10 })
    expect(where(Game.rotated(EMPTY, piece('T', 0, 3, 10), -1))).toEqual({ rotation: 3, x: 3, y: 10 })
    expect(where(Game.rotated(EMPTY, piece('T', 3, 3, 10), -1))).toEqual({ rotation: 2, x: 3, y: 10 })
  })

  test('against the left wall, R to 2 kicks one column right (test 2)', () => {
    // T pointing right with its stem in column 0; pointing down it needs columns 0 to 2
    expect(where(Game.rotated(EMPTY, piece('T', 1, -1, 10), 1))).toEqual({ rotation: 2, x: 0, y: 10 })
  })

  test('against the right wall, L to 2 counterclockwise kicks one column left (test 2)', () => {
    // T pointing left, its long side in column 9
    expect(where(Game.rotated(EMPTY, piece('T', 3, 8, 10), -1))).toEqual({ rotation: 2, x: 7, y: 10 })
  })

  test('on the floor, 0 to R kicks one left and one up (test 3)', () => {
    // flat T resting on the floor; standing it up needs a third row
    expect(where(Game.rotated(EMPTY, piece('T', 0, 4, BOTTOM - 1), 1))).toEqual({ rotation: 1, x: 3, y: BOTTOM - 2 })
  })

  test('in a pocket, 0 to R takes test 5: one left and two down', () => {
    const start = piece('T', 0, 4, 10)
    const end = piece('T', 1, 3, 12)
    expect(where(Game.rotated(pocketFor(start, end), start, 1))).toEqual({ rotation: 1, x: 3, y: 12 })
  })

  test('the same kicks serve J, L, S and Z: a J at the left wall kicks right', () => {
    // J state 1 fills box columns 1 and 2; state 2 needs columns 0 to 2
    for (const kind of ['J', 'L', 'S', 'Z'] as const) {
      expect(where(Game.rotated(EMPTY, piece(kind, 1, -1, 10), 1)), kind).toEqual({ rotation: 2, x: 0, y: 10 })
    }
  })

  test('a turn with no fitting kick fails and returns null', () => {
    const start = piece('T', 0, 4, 10)
    expect(Game.rotated(boardWithHoles(Game.pieceCells(start)), start, 1)).toBe(null)
    expect(Game.rotated(boardWithHoles(Game.pieceCells(start)), start, -1)).toBe(null)
  })
})

describe('rotation with kicks: I', () => {
  test('vertical against the right wall, R to 2 kicks one column left (test 2)', () => {
    // I state 1 is box column 2: box x 7 puts it in column 9
    expect(where(Game.rotated(EMPTY, piece('I', 1, 7, 10), 1))).toEqual({ rotation: 2, x: 6, y: 10 })
  })

  test('vertical against the left wall, R to 2 kicks two columns right (test 3)', () => {
    expect(where(Game.rotated(EMPTY, piece('I', 1, -2, 10), 1))).toEqual({ rotation: 2, x: 0, y: 10 })
  })

  test('vertical L against the left wall, L to 0 kicks one column right (test 2)', () => {
    // I state 3 is box column 1: box x -1 puts it in column 0
    expect(where(Game.rotated(EMPTY, piece('I', 3, -1, 10), 1))).toEqual({ rotation: 0, x: 0, y: 10 })
  })

  test('flat on the floor, 0 to R kicks one right and two up (test 5)', () => {
    // I state 0 is box row 1: box y BOTTOM - 1 puts it on the floor
    expect(where(Game.rotated(EMPTY, piece('I', 0, 3, BOTTOM - 1), 1))).toEqual({ rotation: 1, x: 4, y: BOTTOM - 3 })
  })

  test('in a pocket, 0 to R takes test 4: two left and one down', () => {
    const start = piece('I', 0, 3, 10)
    const end = piece('I', 1, 1, 11)
    expect(where(Game.rotated(pocketFor(start, end), start, 1))).toEqual({ rotation: 1, x: 1, y: 11 })
  })
})

describe('rotation: O', () => {
  test('O turns in place and never moves, even boxed in by its own cells', () => {
    const start = piece('O', 0, 4, 10)
    const tight = boardWithHoles(Game.pieceCells(start))
    for (const direction of [1, -1] as const) {
      expect(where(Game.rotated(tight, start, direction))).toEqual({ rotation: direction === 1 ? 1 : 3, x: 4, y: 10 })
    }
  })
})

describe('locking and clearing', () => {
  test('placing a piece locks its four cells with its kind', () => {
    const placed = Game.placed(EMPTY, piece('O', 0, 3, BOTTOM - 1))
    expect(bottomRows(placed, 2)).toEqual(['....##....', '....##....'])
    expect(placed[BOTTOM]![4]).toBe('O')
    expect(bottomRows(EMPTY, 1), 'the board placed on is unchanged').toEqual(['..........'])
  })

  // the rows are the board's own, 24 deep: the bottom row is 23
  const cases: [string, string[], number, number[], string[]][] = [
    ['no full row clears nothing', ['#########.'], 0, [], ['#########.']],
    ['one full row', ['#.........', '##########'], 1, [23], ['..........', '#.........']],
    ['two full rows with a partial one between keeps the partial one', ['##########', '#.#.#.#.#.', '##########'], 2, [21, 23], ['..........', '..........', '#.#.#.#.#.']],
    ['three full rows', ['.........#', '##########', '##########', '##########'], 3, [21, 22, 23], ['..........', '..........', '..........', '.........#']],
    ['four full rows', ['##########', '##########', '##########', '##########'], 4, [20, 21, 22, 23], ['..........', '..........', '..........', '..........']],
  ]
  for (const [name, rows, cleared, at, after] of cases) {
    test(`clearing: ${name}`, () => {
      const result = Game.clearedRows(boardFrom(...rows))
      expect(result.cleared).toBe(cleared)
      expect(result.rows, 'the rows cleared, as numbered before the clear').toEqual(at)
      expect(bottomRows(result.board, rows.length)).toEqual(after)
      expect(result.board).toHaveLength(Game.ROWS)
    })
  }
})
