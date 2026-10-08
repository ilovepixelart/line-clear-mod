import type { ClientKeyEvent, ClientPointerEvent } from 'claude-code'

import Game from '../game'
import type { GameState, Input } from '../game'
import { inputOfHotkey, inputsOfKey } from './keys'

/** The frame clock's period: the game moves on this much engine time each frame. */
export const TICK_MS = 50

/**
 * How long a clicked game region goes without a key before the game takes
 * it as unfocused and pauses. Nothing tells the region it lost the keys
 * (Escape never reaches it), so silence is the only sign.
 */
export const IDLE_MS = 2_000

/** One press of a pane Button, by its hotkey letter, numbered so a redraw never applies it twice. */
export type Press = { readonly seq: number; readonly key: string }

/**
 * Who has the keyboard: the clicked game region (inferred), the pane's
 * Buttons (the pane says so), or nobody, when the keys go to the prompt.
 */
export type Focus = 'region' | 'pane' | 'none'

/** What the hooks module tells the game: whether the pane holds the keys, and a seed base from its clock. */
export type Outside = { readonly paneFocused: boolean; readonly seedBase: number }

/** The last lock that cleared rows: when, on the frame clock, and how many rows. */
export type Clear = { readonly at: number; readonly rows: number }

/** The game region's own state, kept by the Client between frames. */
export type Play = {
  /** Engine time: TICK_MS per frame of the frame clock. */
  readonly now: number
  /** The game; null before the first one starts. */
  readonly game: GameState | null
  /** Whether the region holds the keys, as inferred from a click and the keys since. */
  readonly region: boolean
  /** When the region last saw a key or a click. */
  readonly lastKeyAt: number
  /** Whether the game was paused because nobody had the keys, so getting them back resumes it. */
  readonly autoPaused: boolean
  /** The last pane press applied. */
  readonly seq: number
  /** Whether the ended game's score was handed to the hooks module. */
  readonly reported: boolean
  /** The last clear in this game, for the flash and the callout; null before one. */
  readonly clear: Clear | null
}

/** A region that has seen nothing yet; presses up to `seq` came before it and are not its to apply. */
export function startPlay(seq: number): Play {
  return { now: 0, game: null, region: false, lastKeyAt: 0, autoPaused: false, seq, reported: false, clear: null }
}

/** The one place that decides who has the keys: a clicked region first, then the focused pane. */
export function focusOf(play: Play, outside: Outside): Focus {
  if (play.region) {
    return 'region'
  }

  return outside.paneFocused ? 'pane' : 'none'
}

const isRunning = (game: GameState | null): game is GameState => game !== null && game.phase !== 'over'

/** The game paused while nobody has the keys, and resumed when somebody has them again, unless the person paused it. */
function synced(play: Play, outside: Outside): Play {
  const { game } = play
  if (!isRunning(game)) {
    return play
  }
  const hasKeys = focusOf(play, outside) !== 'none'
  if (!hasKeys && game.phase === 'playing') {
    return { ...play, game: Game.step(game, 'pause', play.now), autoPaused: true }
  }
  if (hasKeys && play.autoPaused) {
    return { ...play, game: game.phase === 'paused' ? Game.step(game, 'pause', play.now) : game, autoPaused: false }
  }

  return play
}

/** A new game, its seed from the clock: the hooks module's base and the frame clock's time. */
function started(play: Play, outside: Outside): Play {
  const seed = (outside.seedBase + play.now) >>> 0

  return { ...play, game: Game.newGame(seed, { startMs: play.now }), autoPaused: false, reported: false, clear: null }
}

/** `after` with its clear noted when the game in it cleared rows since `before`. */
function noted(before: Play, after: Play): Play {
  const was = before.game
  const { game } = after
  if (was === null || game === null || game === was || game.lines <= was.lines) {
    return after
  }

  return { ...after, clear: { at: after.now, rows: game.lastClear.length } }
}

function applied(play: Play, inputs: readonly Input[]): Play {
  const game = inputs.reduce<GameState | null>((current, input) => (current === null ? null : Game.step(current, input, play.now)), play.game)

  return { ...play, game }
}

/** One frame of the frame clock: time moves on, a silent region lets go of the keys, gravity runs. */
export function ticked(play: Play, outside: Outside): Play {
  const now = play.now + TICK_MS
  const isIdle = play.region && now - play.lastKeyAt >= IDLE_MS
  const moved = synced({ ...play, now, region: play.region && !isIdle }, outside)

  return noted(play, moved.game?.phase === 'playing' ? { ...moved, game: Game.step(moved.game, 'tick', now) } : moved)
}

/** A click on the region: it has the keys now, and a click with no game running starts one. */
export function pointed(play: Play, event: ClientPointerEvent, outside: Outside): Play {
  if (event.type !== 'down') {
    return play
  }
  const focused = { ...play, region: true, lastKeyAt: play.now }

  return isRunning(play.game) ? synced(focused, outside) : started(focused, outside)
}

/**
 * A key on the region. Any key shows the region has the keys; the first one
 * after the region went idle only takes them back (and resumes), so a drop
 * pressed into a paused game does not land unseen. Keys do nothing while no
 * game runs: a click starts one.
 */
export function keyed(play: Play, event: ClientKeyEvent, outside: Outside): Play {
  const wasRegion = play.region
  const focused = synced({ ...play, region: true, lastKeyAt: play.now }, outside)
  if (!wasRegion || !isRunning(focused.game)) {
    return focused
  }

  return noted(play, applied(focused, inputsOfKey(event)))
}

/**
 * The pane Buttons' presses not yet applied, in order; a key that is no
 * hotkey does nothing. With no game running,
 * pause starts one (the keyboard's way to play again) and the rest do nothing.
 */
export function pressed(play: Play, presses: readonly Press[], outside: Outside): Play {
  const fresh = presses.filter(press => press.seq > play.seq)
  if (fresh.length === 0) {
    return play
  }
  let current: Play = synced({ ...play, seq: Math.max(...fresh.map(press => press.seq)) }, outside)
  for (const input of fresh.flatMap(press => inputOfHotkey(press.key) ?? [])) {
    if (isRunning(current.game)) {
      current = applied(current, [input])
    } else if (input === 'pause') {
      current = started(current, outside)
    }
  }

  return noted(play, current)
}

/** The ended game's score while it has not been handed over yet; null otherwise. */
export function scoreToReport(play: Play): number | null {
  return play.game?.phase === 'over' && !play.reported ? play.game.score : null
}
