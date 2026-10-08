import { HIDDEN_ROWS, clearedRows, emptyBoard } from './board'
import type { Board } from './board'
import { KINDS, shuffledBag } from './bag'
import { dropDistance, fits, placed, rotated, shifted } from './moves'
import { pieceCells, spawnPiece } from './pieces'
import type { Piece } from './pieces'
import { seedRandom } from './random'
import { spinOf } from './spin'
import {
  BACK_TO_BACK,
  CLEAR_MS,
  COMBO_POINTS,
  HARD_DROP_POINTS,
  LOCK_DELAY_MS,
  LOCK_RESET_CAP,
  SOFT_DROP_POINTS,
  clearScore,
  isDifficult,
  gravityMs,
  levelFor,
} from './rules'
import type { Spin } from './rules'
import type { Kind, Point } from './types'

/** One thing that happens to a game: a press, or a tick that only lets time pass. */
export type Input = 'tick' | 'left' | 'right' | 'slideLeft' | 'slideRight' | 'softDrop' | 'hardDrop' | 'rotateCw' | 'rotateCcw' | 'hold' | 'pause'

export type Phase = 'playing' | 'paused' | 'over'

export type GameOptions = {
  /** The level to start at, a whole number from 1; 1 by default. */
  startLevel?: number
  /** The time the game starts, on the same clock `step` is given; 0 by default. */
  startMs?: number
}

/** A whole game. Plain data: `step` returns a new one and never changes the one it is given. */
export type GameState = {
  readonly board: Board
  /** The falling piece; null once the game is over. */
  readonly active: Piece | null
  /** The pieces to come, whole bags appended so it always holds more than 7. */
  readonly queue: readonly Kind[]
  readonly hold: Kind | null
  /** False from a hold until the next piece locks. */
  readonly canHold: boolean
  /** The random generator's state, for the next bag. */
  readonly random: number
  readonly score: number
  readonly lines: number
  readonly level: number
  readonly startLevel: number
  readonly phase: Phase
  /** Why the game ended: the next piece had no room (block out), or a piece locked wholly above the well (lock out). */
  readonly over: 'block-out' | 'lock-out' | null
  /** When the falling piece last moved down a row or appeared: gravity counts from here. */
  readonly fallAt: number
  /** When the lock delay last started, while the piece rests on something; null while it can fall. */
  readonly lockAt: number | null
  /** Moves and turns made while resting since the piece reached its lowest row. */
  readonly lockResets: number
  /** The lowest row any of the piece's cells has reached. */
  readonly lowestY: number
  /** When the game was paused, while it is. */
  readonly pausedAt: number | null
  /** The board rows the last lock cleared, top to bottom, numbered as they were before the clear; empty when it cleared none. */
  readonly lastClear: readonly number[]
  /**
   * While cleared rows go, before the next piece enters: when that started and
   * ends, and the last turn and the hold asked for meanwhile, done as it enters.
   */
  readonly clearing: Clearing | null
  /** The kick of the falling piece's last successful move when that move was a turn; null after any other move. */
  readonly turnKick: Point | null
  /** What the last lock did; null before the first. */
  readonly lastAction: Action | null
  /** Whether the last lock that cleared rows made a difficult clear: the next difficult one scores half again. */
  readonly backToBack: boolean
  /** Clears in a row less one: -1 after a lock that cleared nothing, 0 after the first clear, 1 after the second. */
  readonly combo: number
}

/** What a lock did, for scoring and for calling it out: the rows it cleared, its spin and the points it made. */
export type Action = { readonly rows: number; readonly spin: Spin; readonly points: number; readonly backToBack: boolean; readonly combo: number }

/** The pause between a lock that clears rows and the next piece. */
export type Clearing = { readonly startedAt: number; readonly until: number; readonly turn: 1 | -1 | 0; readonly hold: boolean }

/** How many of the pieces to come a preview shows. */
export const PREVIEW_SIZE = 3

/** The queue never runs this short: a bag is appended while it is. */
const QUEUE_FLOOR = KINDS.length

/** The queue with whole bags appended until it is longer than QUEUE_FLOOR, and the generator after them. */
function refilled(queue: readonly Kind[], random: number): { queue: Kind[]; random: number } {
  const next = [...queue]
  let state = random
  while (next.length <= QUEUE_FLOOR) {
    const dealt = shuffledBag(state)
    next.push(...dealt.bag)
    state = dealt.state
  }

  return { queue: next, random: state }
}

/** The lowest row the piece's cells are in. */
const bottomOf = (piece: Piece) => Math.max(...pieceCells(piece).map(({ y }) => y))

const isResting = (board: Board, piece: Piece) => !fits(board, { ...piece, y: piece.y + 1 })

function ended(state: GameState, over: 'block-out' | 'lock-out'): GameState {
  return { ...state, active: null, phase: 'over', over, lockAt: null }
}

/**
 * The game with `kind` entering at time `at`: it spawns, then drops one row
 * at once when there is room, so it shows straight away. Over when there is
 * no room to spawn.
 */
function spawned(state: GameState, kind: Kind, at: number): GameState {
  const spawn = spawnPiece(kind)
  if (!fits(state.board, spawn)) {
    return ended(state, 'block-out')
  }
  const piece = shifted(state.board, spawn, 0, 1) ?? spawn

  return {
    ...state,
    active: piece,
    fallAt: at,
    lockAt: isResting(state.board, piece) ? at : null,
    lockResets: 0,
    lowestY: bottomOf(piece),
  }
}

/** The game with the next piece from the queue entering at time `at`. */
function nextPiece(state: GameState, at: number): GameState {
  const [kind, ...rest] = state.queue
  const { queue, random } = refilled(rest, state.random)

  return spawned({ ...state, queue, random, canHold: true }, kind!, at)
}

/** The falling piece locked into the board at time `at`: rows cleared, scored, and the next piece on. */
function locked(state: GameState, at: number): GameState {
  const piece = state.active!
  if (pieceCells(piece).every(({ y }) => y < HIDDEN_ROWS)) {
    return ended({ ...state, board: placed(state.board, piece) }, 'lock-out')
  }
  const spin = spinOf(state.board, piece, state.turnKick)
  const { board, cleared, rows } = clearedRows(placed(state.board, piece))
  const lines = state.lines + cleared
  const difficult = isDifficult(cleared, spin)
  const isBackToBack = difficult && state.backToBack
  const combo = cleared === 0 ? -1 : state.combo + 1
  const comboPoints = combo > 0 ? COMBO_POINTS * combo * state.level : 0
  const points = Math.floor(clearScore(cleared, state.level, spin) * (isBackToBack ? BACK_TO_BACK : 1)) + comboPoints

  const scored = {
    ...state,
    board,
    score: state.score + points,
    lines,
    level: levelFor(state.startLevel, lines),
    lastClear: rows,
    turnKick: null,
    lastAction: { rows: cleared, spin, points, backToBack: isBackToBack, combo },
    backToBack: cleared === 0 ? state.backToBack : difficult,
    combo,
  }
  if (cleared === 0) {
    return nextPiece(scored, at)
  }

  return { ...scored, active: null, lockAt: null, clearing: { startedAt: at, until: at + CLEAR_MS, turn: 0, hold: false } }
}

/** The next piece entering once the clearing ends, with the hold and the turn asked for meanwhile. */
function cleared(state: GameState, clearing: Clearing): GameState {
  const at = clearing.until
  let next = nextPiece({ ...state, clearing: null }, at)
  if (clearing.hold && next.phase === 'playing') {
    next = held(next, at)
  }
  if (clearing.turn !== 0 && next.phase === 'playing') {
    next = pressed(next, clearing.turn === 1 ? 'rotateCw' : 'rotateCcw', at)
  }

  return next
}

/** An input while rows clear: a turn or a hold is kept for the next piece, anything else is dropped. */
function buffered(state: GameState, clearing: Clearing, input: Input): GameState {
  if (input === 'rotateCw' || input === 'rotateCcw') {
    return { ...state, clearing: { ...clearing, turn: input === 'rotateCw' ? 1 : -1 } }
  }

  return input === 'hold' ? { ...state, clearing: { ...clearing, hold: true } } : state
}

/**
 * The game with the falling piece moved to `piece` at time `at`. A piece at a
 * new lowest row gets its lock resets back; a move made while resting spends
 * one. A piece that rests afterwards restarts its lock delay, unless it has
 * spent more than LOCK_RESET_CAP, when it locks at once.
 */
function movedTo(state: GameState, piece: Piece, at: number, isPress: boolean, turnKick: Point | null = null): GameState {
  const bottom = bottomOf(piece)
  const isLower = bottom > state.lowestY
  const wasResting = state.lockAt !== null
  const lockResets = isLower ? 0 : state.lockResets + (isPress && wasResting ? 1 : 0)
  const moved = { ...state, active: piece, lowestY: Math.max(bottom, state.lowestY), lockResets, turnKick }
  if (!isResting(state.board, piece)) {
    // a piece that leaves a rest starts its gravity clock there, not at its last fall
    return { ...moved, lockAt: null, fallAt: wasResting ? at : state.fallAt }
  }

  return lockResets > LOCK_RESET_CAP ? locked(moved, at) : { ...moved, lockAt: at }
}

/** One thing time does by `now`: a row of gravity or a lock, or the same state when nothing is due. */
function timeStep(state: GameState, now: number): GameState {
  if (state.clearing !== null) {
    return now >= state.clearing.until ? cleared(state, state.clearing) : state
  }
  const piece = state.active!
  if (state.lockAt !== null) {
    const lockDue = state.lockAt + LOCK_DELAY_MS

    return now >= lockDue ? locked(state, lockDue) : state
  }
  const fallDue = state.fallAt + gravityMs(state.level)
  if (now < fallDue) {
    return state
  }

  return movedTo({ ...state, fallAt: fallDue }, { ...piece, y: piece.y + 1 }, fallDue, false)
}

/** The game with everything time does up to `now` done, in order. */
function caughtUp(state: GameState, now: number): GameState {
  let current = state
  while (current.phase === 'playing') {
    const next = timeStep(current, now)
    if (next === current) {
      return current
    }
    current = next
  }

  return current
}

function softDropped(state: GameState, now: number): GameState {
  const down = shifted(state.board, state.active!, 0, 1)
  if (down === null) {
    return state
  }

  return movedTo({ ...state, fallAt: now, score: state.score + SOFT_DROP_POINTS }, down, now, false)
}

function hardDropped(state: GameState, now: number): GameState {
  const piece = state.active!
  const rows = dropDistance(state.board, piece)

  const turnKick = rows === 0 ? state.turnKick : null

  return locked({ ...state, active: { ...piece, y: piece.y + rows }, score: state.score + rows * HARD_DROP_POINTS, turnKick }, now)
}

/** The game after a press that moves or turns the piece; the same game when it cannot. */
function pressed(state: GameState, input: 'left' | 'right' | 'rotateCw' | 'rotateCcw', now: number): GameState {
  const piece = state.active!
  const moved =
    input === 'left' || input === 'right'
      ? shifted(state.board, piece, input === 'left' ? -1 : 1, 0)
      : rotated(state.board, piece, input === 'rotateCw' ? 1 : -1)

  if (moved === null) {
    return state
  }
  const isTurn = input === 'rotateCw' || input === 'rotateCcw'

  return movedTo(state, moved, now, true, isTurn ? { x: moved.x - piece.x, y: moved.y - piece.y } : null)
}

/** The game after a slide: the piece moved left or right as far as it goes, as one move. The same game when it cannot move. */
function slid(state: GameState, input: 'slideLeft' | 'slideRight', now: number): GameState {
  const dx = input === 'slideLeft' ? -1 : 1
  let piece = state.active!
  for (let next = shifted(state.board, piece, dx, 0); next !== null; next = shifted(state.board, next, dx, 0)) {
    piece = next
  }

  return piece === state.active ? state : movedTo(state, piece, now, true)
}

/** The game after a hold: the falling piece is kept and the held one (or the next) enters. Once per piece. */
function held(state: GameState, now: number): GameState {
  if (!state.canHold) {
    return state
  }
  const keeping = { ...state, hold: state.active!.kind }
  const swapped = state.hold === null ? nextPiece(keeping, now) : spawned(keeping, state.hold, now)

  return { ...swapped, canHold: false }
}

function applied(state: GameState, input: Input, now: number): GameState {
  switch (input) {
    case 'left':
    case 'right':
    case 'rotateCw':
    case 'rotateCcw':
      return pressed(state, input, now)
    case 'slideLeft':
    case 'slideRight':
      return slid(state, input, now)
    case 'softDrop':
      return softDropped(state, now)
    case 'hardDrop':
      return hardDropped(state, now)
    case 'hold':
      return held(state, now)
    default:
      return state
  }
}

/** The paused game playing again at `now`, its gravity and lock clocks moved on by the time it was paused. */
function resumed(state: GameState, now: number): GameState {
  const pausedFor = Math.max(0, now - (state.pausedAt ?? now))

  return {
    ...state,
    phase: 'playing',
    pausedAt: null,
    fallAt: state.fallAt + pausedFor,
    lockAt: state.lockAt === null ? null : state.lockAt + pausedFor,
    clearing: state.clearing === null ? null : { ...state.clearing, startedAt: state.clearing.startedAt + pausedFor, until: state.clearing.until + pausedFor },
  }
}

/** A new game from a seed: the same seed and options always give the same game. */
export function newGame(seed: number, options: GameOptions = {}): GameState {
  const startLevel = options.startLevel ?? 1
  if (!Number.isInteger(startLevel) || startLevel < 1) {
    throw new RangeError(`startLevel must be a whole number from 1, not ${startLevel}`)
  }
  const { queue, random } = refilled([], seedRandom(seed))
  const empty: GameState = {
    board: emptyBoard(),
    active: null,
    queue,
    hold: null,
    canHold: true,
    random,
    score: 0,
    lines: 0,
    level: startLevel,
    startLevel,
    phase: 'playing',
    over: null,
    fallAt: 0,
    lockAt: null,
    lockResets: 0,
    lowestY: 0,
    pausedAt: null,
    lastClear: [],
    clearing: null,
    turnKick: null,
    lastAction: null,
    backToBack: false,
    combo: -1,
  }

  return nextPiece(empty, options.startMs ?? 0)
}

/**
 * The game after `input` at time `nowMs`. Time is applied first (gravity rows
 * and locks due by `nowMs`, in order), then the input. Pure: the same state,
 * input and time always give the same result.
 */
export function step(state: GameState, input: Input, nowMs: number): GameState {
  if (state.phase === 'paused') {
    return input === 'pause' ? resumed(state, nowMs) : state
  }
  if (state.phase === 'over') {
    return state
  }
  const current = caughtUp(state, nowMs)
  if (current.phase !== 'playing') {
    return current
  }

  if (input === 'pause') {
    return { ...current, phase: 'paused', pausedAt: nowMs }
  }

  return current.clearing === null ? applied(current, input, nowMs) : buffered(current, current.clearing, input)
}

const toVisible = ({ x, y }: Point): Point => ({ x, y: y - HIDDEN_ROWS })
const isVisible = ({ y }: Point) => y >= 0

/** The visible rows, top to bottom: locked cells and the falling piece, each cell its kind or null. */
export function boardOf(state: GameState): (Kind | null)[][] {
  const rows = state.board.slice(HIDDEN_ROWS).map(row => [...row])
  if (state.active !== null) {
    for (const { x, y } of pieceCells(state.active).map(toVisible).filter(isVisible)) {
      rows[y]![x] = state.active.kind
    }
  }

  return rows
}

/** The falling piece's visible cells. */
export function activeOf(state: GameState): Point[] {
  return state.active === null ? [] : pieceCells(state.active).map(toVisible).filter(isVisible)
}

/** Where a hard drop would put the falling piece: its visible cells. */
export function ghostOf(state: GameState): Point[] {
  const piece = state.active
  if (piece === null) {
    return []
  }

  return pieceCells({ ...piece, y: piece.y + dropDistance(state.board, piece) })
    .map(toVisible)
    .filter(isVisible)
}

/** The rows going while a clear holds the next piece back, and when that started and ends; null otherwise. */
export function clearingOf(state: GameState): { rows: readonly number[]; startedAt: number; until: number } | null {
  return state.clearing === null ? null : { rows: state.lastClear, startedAt: state.clearing.startedAt, until: state.clearing.until }
}

/** The next PREVIEW_SIZE pieces, the first one next. */
export function nextOf(state: GameState): Kind[] {
  return state.queue.slice(0, PREVIEW_SIZE)
}

/** The held piece, and whether a hold is allowed now. */
export function holdOf(state: GameState): { kind: Kind | null; canHold: boolean } {
  return { kind: state.hold, canHold: state.canHold && state.phase === 'playing' }
}

export const scoreOf = (state: GameState) => state.score
export const levelOf = (state: GameState) => state.level
export const linesOf = (state: GameState) => state.lines
export const phaseOf = (state: GameState) => state.phase
