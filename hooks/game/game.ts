import { HIDDEN_ROWS, clearedRows, emptyBoard } from './board'
import type { Board } from './board'
import { KINDS, shuffledBag } from './bag'
import { dropDistance, fits, placed, rotated, shifted } from './moves'
import { pieceCells, spawnPiece } from './pieces'
import type { Piece } from './pieces'
import { seedRandom } from './random'
import {
  HARD_DROP_POINTS,
  LOCK_DELAY_MS,
  LOCK_RESET_CAP,
  SOFT_DROP_POINTS,
  clearScore,
  gravityMs,
  levelFor,
} from './rules'
import type { Kind, Point } from './types'

/** One thing that happens to a game: a press, or a tick that only lets time pass. */
export type Input = 'tick' | 'left' | 'right' | 'softDrop' | 'hardDrop' | 'rotateCw' | 'rotateCcw' | 'hold' | 'pause'

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
  /** The lowest row the piece's box has reached. */
  readonly lowestY: number
  /** When the game was paused, while it is. */
  readonly pausedAt: number | null
  /** The board rows the last lock cleared, top to bottom, numbered as they were before the clear; empty when it cleared none. */
  readonly lastClear: readonly number[]
}

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

const isResting = (board: Board, piece: Piece) => !fits(board, { ...piece, y: piece.y + 1 })

function ended(state: GameState, over: 'block-out' | 'lock-out'): GameState {
  return { ...state, active: null, phase: 'over', over, lockAt: null }
}

/** The game with `kind` entering at its spawn position at time `at`, or over when there is no room. */
function spawned(state: GameState, kind: Kind, at: number): GameState {
  const piece = spawnPiece(kind)
  if (!fits(state.board, piece)) {
    return ended(state, 'block-out')
  }

  return {
    ...state,
    active: piece,
    fallAt: at,
    lockAt: isResting(state.board, piece) ? at : null,
    lockResets: 0,
    lowestY: piece.y,
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
  const { board, cleared, rows } = clearedRows(placed(state.board, piece))
  const lines = state.lines + cleared

  return nextPiece(
    {
      ...state,
      board,
      score: state.score + clearScore(cleared, state.level),
      lines,
      level: levelFor(state.startLevel, lines),
      lastClear: rows,
    },
    at,
  )
}

/**
 * The game with the falling piece moved to `piece` at time `at`. A piece at a
 * new lowest row gets its lock resets back; a move made while resting spends
 * one. A piece that rests afterwards restarts its lock delay, unless it has
 * spent more than LOCK_RESET_CAP, when it locks at once.
 */
function movedTo(state: GameState, piece: Piece, at: number, isPress: boolean): GameState {
  const isLower = piece.y > state.lowestY
  const wasResting = state.lockAt !== null
  const lockResets = isLower ? 0 : state.lockResets + (isPress && wasResting ? 1 : 0)
  const moved = { ...state, active: piece, lowestY: Math.max(piece.y, state.lowestY), lockResets }
  if (!isResting(state.board, piece)) {
    // a piece that leaves a rest starts its gravity clock there, not at its last fall
    return { ...moved, lockAt: null, fallAt: wasResting ? at : state.fallAt }
  }

  return lockResets > LOCK_RESET_CAP ? locked(moved, at) : { ...moved, lockAt: at }
}

/** One thing time does by `now`: a row of gravity or a lock, or the same state when nothing is due. */
function timeStep(state: GameState, now: number): GameState {
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

  return locked({ ...state, active: { ...piece, y: piece.y + rows }, score: state.score + rows * HARD_DROP_POINTS }, now)
}

/** The game after a press that moves or turns the piece; the same game when it cannot. */
function pressed(state: GameState, input: 'left' | 'right' | 'rotateCw' | 'rotateCcw', now: number): GameState {
  const piece = state.active!
  const moved =
    input === 'left' || input === 'right'
      ? shifted(state.board, piece, input === 'left' ? -1 : 1, 0)
      : rotated(state.board, piece, input === 'rotateCw' ? 1 : -1)

  return moved === null ? state : movedTo(state, moved, now, true)
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

  return input === 'pause' ? { ...current, phase: 'paused', pausedAt: nowMs } : applied(current, input, nowMs)
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
