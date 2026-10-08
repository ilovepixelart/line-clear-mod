import type { ClientElements, Color, RenderElement } from 'claude-code'

import Game from '../game'
import type { GameState, Kind, Point } from '../game'
import { COLORS, GHOST_COLORS, PIECE_COLORS } from './palette'
import { focusOf } from './play'
import type { Focus, Outside, Play } from './play'

/** A run of text drawn in one style. */
export type Segment = { readonly text: string; readonly color?: Color; readonly backgroundColor?: Color; readonly dimColor?: true; readonly bold?: true }

/** One terminal line: segments side by side. */
export type Line = readonly Segment[]

/** A filled cell: two full blocks, square in most terminal fonts (half blocks draw as thin bars in some). */
export const CELL = '██'
/** Where a hard drop would land the falling piece: shaded, so it never reads as a locked cell. */
export const GHOST = '▓▓'
/** An empty cell of the well. */
export const EMPTY = '· '

const PANEL = 10
const GAP = 2
const WELL_INNER = Game.WIDTH * CELL.length
const WELL = WELL_INNER + 2

/** The columns the game takes: hold panel, well, next panel and the gaps between. */
export const GAME_COLUMNS = PANEL + GAP + WELL + GAP + PANEL

/** The rows the game takes: the well with its frame, and the status line. */
export const GAME_ROWS = Game.VISIBLE_ROWS + 3

/** What each focus says on the status line: who has the keys, and how to give them back or get them. */
export const STATUS: Readonly<Record<Focus, string>> = {
  region: 'playing · Esc gives keys back',
  pane: 'keys: w a s d · Esc gives keys back',
  none: 'click to play · or ctrl+x tab, then w a s d',
}

const CONTROL = /[\u0000-\u001f\u007f-\u009f]/g

/** Text safe to draw: a control character in a Text child unmounts the region for good. */
export const safe = (text: string): string => text.replace(CONTROL, '')

const plain = (text: string, color?: Color): Segment => (color === undefined ? { text } : { text, color })
const pad = (text: string, width: number) => text + ' '.repeat(Math.max(0, width - text.length))
const centred = (text: string, width: number) => pad(' '.repeat(Math.max(0, Math.floor((width - text.length) / 2))) + text, width)

/** A kind's spawn cells, moved to the top left and centred in a four-cell box: two rows of segments. */
function miniPiece(kind: Kind | null): Line[] {
  if (kind === null) {
    return [[plain(' '.repeat(8))], [plain(' '.repeat(8))]]
  }
  const cells = Game.cellsOf(kind, 0)
  const left = Math.min(...cells.map(cell => cell.x))
  const top = Math.min(...cells.map(cell => cell.y))
  const width = Math.max(...cells.map(cell => cell.x)) - left + 1
  const offset = Math.floor((4 - width) / 2)
  const tile: Segment = { text: CELL, color: PIECE_COLORS[kind] }

  return [0, 1].map(row =>
    [0, 1, 2, 3].map(column =>
      cells.some(cell => cell.x - left === column - offset && cell.y - top === row) ? tile : plain('  '),
    ),
  )
}

const boxTop = (inner: number, color: Color = COLORS.frame) => plain(`╭${'─'.repeat(inner)}╮`, color)
const boxBottom = (inner: number, color: Color = COLORS.frame) => plain(`╰${'─'.repeat(inner)}╯`, color)
const boxed = (line: Line, color: Color = COLORS.frame): Line => [plain('│', color), ...line, plain('│', color)]

/**
 * The hold box and the numbers under it, PANEL wide. After a hold the piece
 * keeps its color (grey read as broken); the label says used and the frame
 * goes quiet until the next piece enters.
 */
function holdPanel(game: GameState | null, best: number): Line[] {
  const kind = game?.hold ?? null
  const isUsed = game !== null && !game.canHold
  const frame = isUsed ? COLORS.label : COLORS.frame
  const score = game?.score ?? 0
  const stat = (label: string, value: number): Line[] => [[plain(pad(label, PANEL), COLORS.label)], [{ text: pad(String(value), PANEL), color: COLORS.value, bold: true }], [plain(' '.repeat(PANEL))]]

  return [
    [plain(pad(isUsed ? 'hold  used' : 'hold', PANEL), COLORS.label)],
    [boxTop(8, frame)],
    ...miniPiece(kind).map(line => boxed(line, frame)),
    [boxBottom(8, frame)],
    [plain(' '.repeat(PANEL))],
    ...stat('score', score),
    ...stat('level', game?.level ?? 1),
    ...stat('lines', game?.lines ?? 0),
    ...stat('best', Math.max(best, score)),
  ]
}

/** The next three pieces, PANEL wide. */
function nextPanel(game: GameState | null): Line[] {
  const next = game === null ? [] : Game.nextOf(game)
  const blank: Line = [plain(' '.repeat(8))]
  const pieces = [0, 1, 2].flatMap(at => [...miniPiece(next[at] ?? null), ...(at < 2 ? [blank] : [])])

  return [[plain(pad('next', PANEL), COLORS.label)], [boxTop(8)], ...pieces.map(line => boxed(line)), [boxBottom(8)]]
}

/** What the well shows over the board: the lines of a card, or none. */
function cardOf(play: Play, outside: Outside): string[] | null {
  const focus = focusOf(play, outside)
  const { game } = play
  if (game?.phase === 'over') {
    return ['game over', `score ${game.score}`, '', focus === 'pane' ? 'p to play again' : 'click to play again']
  }
  if (focus === 'none') {
    return ['click to play']
  }
  if (game === null) {
    return [focus === 'pane' ? 'p to play' : 'click to play']
  }

  return game.phase === 'paused' ? ['paused', 'p resumes'] : null
}

const has = (points: readonly Point[], x: number, y: number) => points.some(point => point.x === x && point.y === y)

/** The well's visible rows: locked cells and the falling piece as tiles, the ghost shaded under it. */
function boardRows(game: GameState | null): Line[] {
  const board = game === null ? null : Game.boardOf(game)
  const ghost = game === null ? [] : Game.ghostOf(game)
  const kind = game?.active?.kind

  return Array.from({ length: Game.VISIBLE_ROWS }, (_, y) =>
    Array.from({ length: Game.WIDTH }, (_, x): Segment => {
      const cell = board?.[y]?.[x] ?? null
      if (cell !== null) {
        return { text: CELL, color: PIECE_COLORS[cell] }
      }

      return kind !== undefined && has(ghost, x, y) ? { text: GHOST, color: GHOST_COLORS[kind] } : plain(EMPTY, COLORS.grid)
    }),
  )
}

/** The board with a card laid across its middle rows: a blank row above and below the text. */
function withCard(rows: Line[], card: string[] | null): Line[] {
  if (card === null) {
    return rows
  }
  const lines = ['', ...card, '']
  const top = Math.floor((rows.length - lines.length) / 2)

  return rows.map((row, y) => {
    const text = lines[y - top]
    if (text === undefined) {
      return row
    }
    const isTitle = y - top === 1

    return [{ text: centred(text, WELL_INNER), color: COLORS.cardText, backgroundColor: COLORS.card, ...(isTitle ? { bold: true as const } : {}) }]
  })
}

function well(play: Play, outside: Outside): Line[] {
  return [[boxTop(WELL_INNER)], ...withCard(boardRows(play.game), cardOf(play, outside)).map(line => boxed(line)), [boxBottom(WELL_INNER)]]
}

const widthOf = (line: Line) => line.reduce((sum, segment) => sum + segment.text.length, 0)
const filled = (line: Line | undefined, width: number): Line => {
  const row = line ?? []

  return [...row, plain(' '.repeat(Math.max(0, width - widthOf(row))))]
}

/**
 * What the game region draws, line by line, at `columns` wide: the hold
 * panel, the well and the next panel side by side, centred, then the status
 * line. Narrower than the game, one line asks for room instead.
 */
export function screenOf(play: Play, outside: Outside & { readonly best: number }, columns: number): Line[] {
  if (columns > 0 && columns < GAME_COLUMNS) {
    return [[plain(`line-clear needs ${GAME_COLUMNS} columns: widen the pane`, COLORS.away)]]
  }
  const margin = plain(' '.repeat(Math.max(0, Math.floor((columns - GAME_COLUMNS) / 2))))
  const left = holdPanel(play.game, outside.best)
  const middle = well(play, outside)
  const right = nextPanel(play.game)
  const gap = plain(' '.repeat(GAP))
  const rows = middle.map((line, y) => [margin, ...filled(left[y], PANEL), gap, ...line, gap, ...filled(right[y], PANEL)])
  const focus = focusOf(play, outside)
  const status = { text: STATUS[focus], color: focus === 'none' ? COLORS.away : COLORS.keys, bold: true as const }

  return [...rows, [margin, status]].map(trimmed)
}

/** The line with its trailing spaces cut and its neighbouring segments of one style joined. */
function trimmed(line: Line): Line {
  const joined: Segment[] = []
  for (const segment of line) {
    const last = joined.at(-1)
    if (last !== undefined && sameStyle(last, segment)) {
      joined[joined.length - 1] = { ...last, text: last.text + segment.text }
    } else {
      joined.push(segment)
    }
  }
  // trailing spaces show nothing unless a background paints them
  while (joined.length > 0 && joined.at(-1)!.backgroundColor === undefined) {
    const end = joined.at(-1)!
    const text = end.text.trimEnd()
    if (text !== '') {
      joined[joined.length - 1] = { ...end, text }
      break
    }
    joined.pop()
  }

  return joined
}

const sameStyle = (a: Segment, b: Segment) =>
  a.color === b.color && a.backgroundColor === b.backgroundColor && a.dimColor === b.dimColor && a.bold === b.bold

/** A line as the text it shows. */
export const textOf = (line: Line): string => line.map(segment => segment.text).join('')

/** The lines as the tree the region draws: a column of one Text per line, a Text per segment, every text made safe. */
export function screenTree(elements: Pick<ClientElements, 'Box' | 'Text'>, lines: readonly Line[]): RenderElement {
  const { Box, Text } = elements

  return Box({
    flexDirection: 'column',
    children: lines.map(line => Text({ children: line.map(({ text, ...style }) => Text({ ...style, children: safe(text) })) })),
  })
}
