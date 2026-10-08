import { describe, expect, test, tier } from 'claude-code/testing'

import Game from '../../hooks/game'
import type { Kind, Point, Rotation } from '../../hooks/game'

tier('user')

/** Cells as "x,y" strings in a stable order, so shapes compare as sets. */
const keysOf = (cells: readonly Point[]) => cells.map(({ x, y }) => `${x},${y}`).sort()

/** Writes a shape the way it is drawn, rows top to bottom, `#` for a cell. */
function drawn(...rows: string[]): string[] {
  const cells: Point[] = []
  rows.forEach((row, y) => [...row].forEach((char, x) => char === '#' && cells.push({ x, y })))

  return keysOf(cells)
}

const shape = (kind: Kind, rotation: Rotation) => keysOf(Game.cellsOf(kind, rotation))

describe('rotation states', () => {
  test('I turns about the centre of its 4 by 4 box', () => {
    expect(shape('I', 0)).toEqual(drawn('....', '####'))
    expect(shape('I', 1)).toEqual(drawn('..#.', '..#.', '..#.', '..#.'))
    expect(shape('I', 2)).toEqual(drawn('....', '....', '####'))
    expect(shape('I', 3)).toEqual(drawn('.#..', '.#..', '.#..', '.#..'))
  })

  test('T spawns flat side down and turns about its centre cell', () => {
    expect(shape('T', 0)).toEqual(drawn('.#.', '###'))
    expect(shape('T', 1)).toEqual(drawn('.#.', '.##', '.#.'))
    expect(shape('T', 2)).toEqual(drawn('...', '###', '.#.'))
    expect(shape('T', 3)).toEqual(drawn('.#.', '##.', '.#.'))
  })

  test('J, L, S and Z spawn and turn clockwise once as drawn', () => {
    expect(shape('J', 0)).toEqual(drawn('#..', '###'))
    expect(shape('J', 1)).toEqual(drawn('.##', '.#.', '.#.'))
    expect(shape('L', 0)).toEqual(drawn('..#', '###'))
    expect(shape('L', 1)).toEqual(drawn('.#.', '.#.', '.##'))
    expect(shape('S', 0)).toEqual(drawn('.##', '##.'))
    expect(shape('S', 1)).toEqual(drawn('.#.', '.##', '..#'))
    expect(shape('Z', 0)).toEqual(drawn('##.', '.##'))
    expect(shape('Z', 1)).toEqual(drawn('..#', '.##', '.#.'))
  })

  test('J and L turned twice are their spawn shapes upside down', () => {
    expect(shape('J', 2)).toEqual(drawn('...', '###', '..#'))
    expect(shape('L', 3)).toEqual(drawn('##.', '.#.', '.#.'))
  })

  test('O is the same square in every state', () => {
    for (const rotation of [0, 1, 2, 3] as const) {
      expect(shape('O', rotation)).toEqual(drawn('.##', '.##'))
    }
  })

  test('every state of every kind has exactly four distinct cells', () => {
    for (const kind of Game.KINDS) {
      for (const rotation of [0, 1, 2, 3] as const) {
        expect(new Set(shape(kind, rotation)).size).toBe(4)
      }
    }
  })
})

describe('spawn', () => {
  // Rows 0 to 3 are hidden above the 18 visible rows: pieces spawn in rows 2 and 3,
  // the I in row 3, just above the visible well, centred, the 3-wide ones left of
  // centre: rows 21 and 22 of the later SRS games, counted from the floor of 20.
  const spawned = (kind: Kind) => keysOf(Game.pieceCells(Game.spawnPiece(kind)))

  test('I spawns flat in row 3, columns 3 to 6', () => {
    expect(spawned('I')).toEqual(keysOf([3, 4, 5, 6].map(x => ({ x, y: 3 }))))
  })

  test('O spawns in columns 4 and 5, rows 2 and 3', () => {
    expect(spawned('O')).toEqual(keysOf([{ x: 4, y: 2 }, { x: 5, y: 2 }, { x: 4, y: 3 }, { x: 5, y: 3 }]))
  })

  test('T spawns in columns 3 to 5, its point in row 2', () => {
    expect(spawned('T')).toEqual(keysOf([{ x: 4, y: 2 }, { x: 3, y: 3 }, { x: 4, y: 3 }, { x: 5, y: 3 }]))
  })

  test('every piece spawns in state 0, entirely in the hidden rows', () => {
    for (const kind of Game.KINDS) {
      const piece = Game.spawnPiece(kind)
      expect(piece.rotation).toBe(0)
      for (const { y } of Game.pieceCells(piece)) {
        expect(y).toBeLessThan(Game.HIDDEN_ROWS)
      }
    }
  })
})

describe('kick table', () => {
  // The published SRS wall kick data, copied by hand, x right and y UP, test 1 first.
  const JLSTZ: Record<string, [number, number][]> = {
    '0>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '1>0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '1>2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '2>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '2>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    '3>2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '3>0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '0>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  }
  const I: Record<string, [number, number][]> = {
    '0>1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    '1>0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    '1>2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
    '2>1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    '2>3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    '3>2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    '3>0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    '0>3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  }
  const turns = Object.keys(JLSTZ).map(key => key.split('>').map(Number) as [Rotation, Rotation])
  /** The engine's offsets back in the published orientation (y up). */
  const published = (kind: Kind, from: Rotation, to: Rotation) => Game.kicksFor(kind, from, to).map(({ x, y }) => [x, 0 - y])

  test('J, L, S, T and Z use the published JLSTZ table for all eight turns', () => {
    for (const kind of ['J', 'L', 'S', 'T', 'Z'] as const) {
      for (const [from, to] of turns) {
        expect(published(kind, from, to)).toEqual(JLSTZ[`${from}>${to}`])
      }
    }
  })

  test('I uses the published I table for all eight turns', () => {
    for (const [from, to] of turns) {
      expect(published('I', from, to)).toEqual(I[`${from}>${to}`])
    }
  })

  test('O never kicks: its only test is to stay where it is', () => {
    for (const [from, to] of turns) {
      expect(published('O', from, to)).toEqual([[0, 0]])
    }
  })

  test('the tables agree with the per-state offset form of the same system', () => {
    // A second, independent statement of the data: each state has five offsets, and a
    // turn's kick n is offset[from][n] minus offset[to][n]. I's offsets also move its
    // centre, so its kicks are compared relative to test 1.
    const jlstzOffsets: [number, number][][] = [
      [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
      [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
      [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
      [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    ]
    const iOffsets: [number, number][][] = [
      [[0, 0], [-1, 0], [2, 0], [-1, 0], [2, 0]],
      [[-1, 0], [0, 0], [0, 0], [0, 1], [0, -2]],
      [[-1, 1], [1, 1], [-2, 1], [1, 0], [-2, 0]],
      [[0, 1], [0, 1], [0, 1], [0, -1], [0, 2]],
    ]
    const fromOffsets = (offsets: [number, number][][], from: Rotation, to: Rotation) => {
      const raw = offsets[from]!.map(([x, y], n) => [x - offsets[to]![n]![0], y - offsets[to]![n]![1]])
      const [baseX, baseY] = raw[0]!

      return raw.map(([x, y]) => [x! - baseX!, y! - baseY!])
    }
    for (const [from, to] of turns) {
      expect(published('T', from, to)).toEqual(fromOffsets(jlstzOffsets, from, to))
      expect(published('I', from, to)).toEqual(fromOffsets(iOffsets, from, to))
    }
  })
})
