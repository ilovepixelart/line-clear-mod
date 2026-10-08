import { HIDDEN_ROWS } from './board'
import type { Kind, Point } from './types'

/** 0 is the spawn state, 1 one turn clockwise, 2 two turns, 3 one turn counterclockwise. */
export type Rotation = 0 | 1 | 2 | 3

/** A piece in play: its kind, its rotation state and where its bounding box's top left sits. */
export type Piece = { readonly kind: Kind; readonly rotation: Rotation; readonly x: number; readonly y: number }

type Shape = { size: number; cells: readonly Point[] }

const at = (x: number, y: number): Point => ({ x, y })

/** Each kind's spawn state inside its bounding box, the rotation system's standard placements. */
const SHAPES: Record<Kind, Shape> = {
  I: { size: 4, cells: [at(0, 1), at(1, 1), at(2, 1), at(3, 1)] },
  O: { size: 3, cells: [at(1, 0), at(2, 0), at(1, 1), at(2, 1)] },
  T: { size: 3, cells: [at(1, 0), at(0, 1), at(1, 1), at(2, 1)] },
  S: { size: 3, cells: [at(1, 0), at(2, 0), at(0, 1), at(1, 1)] },
  Z: { size: 3, cells: [at(0, 0), at(1, 0), at(1, 1), at(2, 1)] },
  J: { size: 3, cells: [at(0, 0), at(0, 1), at(1, 1), at(2, 1)] },
  L: { size: 3, cells: [at(2, 0), at(0, 1), at(1, 1), at(2, 1)] },
}

/** The cells of a kind in a rotation state, relative to its bounding box. O does not turn. */
export function cellsOf(kind: Kind, rotation: Rotation): Point[] {
  const { size, cells } = SHAPES[kind]
  const turns = kind === 'O' ? 0 : rotation
  let turned = [...cells]
  for (let i = 0; i < turns; i++) {
    turned = turned.map(({ x, y }) => at(size - 1 - y, x))
  }

  return turned
}

/** A piece's cells on the board. */
export function pieceCells(piece: Piece): Point[] {
  return cellsOf(piece.kind, piece.rotation).map(({ x, y }) => at(piece.x + x, piece.y + y))
}

/**
 * Where each kind spawns: flat, centred (3-wide boxes left of centre), in the
 * two hidden rows just above the well, the I in the lower one.
 */
export function spawnPiece(kind: Kind): Piece {
  return { kind, rotation: 0, x: 3, y: HIDDEN_ROWS - 2 }
}

/**
 * Wall kicks: the offsets a turn tries in order, the first that fits wins.
 * The data is the Super Rotation System's published kick table, as given on
 * the Hard Drop wiki's SRS page (https://harddrop.com/wiki/SRS), written here
 * as published: x right, y UP. `kicksFor` turns y down to match the board.
 */
const JLSTZ_KICKS: Record<string, readonly (readonly [number, number])[]> = {
  '0>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '1>0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '1>2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '2>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '2>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '3>2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '3>0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '0>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
}

const I_KICKS: Record<string, readonly (readonly [number, number])[]> = {
  '0>1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '1>0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '1>2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  '2>1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '2>3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '3>2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '3>0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '0>3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
}

/** The offsets a turn from one state to an adjacent one tries, in board terms (y down). O only stays put. */
export function kicksFor(kind: Kind, from: Rotation, to: Rotation): Point[] {
  if (kind === 'O') {
    return [at(0, 0)]
  }
  const table = kind === 'I' ? I_KICKS : JLSTZ_KICKS

  // 0 - y rather than -y: a -0 offset would compare unequal to 0 under deep equality
  return (table[`${from}>${to}`] ?? []).map(([x, y]) => at(x, 0 - y))
}
