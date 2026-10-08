import type { Color } from 'claude-code'

import type { Kind } from '../game'

/**
 * The game's own colors, for a dark terminal: soft dusk tones, one per
 * piece, each distinct from its neighbours in hue and lightness. Chrome uses
 * the person's theme keys where one fits.
 */
export const PIECE_COLORS: Readonly<Record<Kind, Color>> = {
  I: '#E59BC4',
  O: '#7ED6C0',
  T: '#F0C987',
  S: '#9FB3FF',
  Z: '#5FC4DA',
  J: '#F49A7E',
  L: '#B5D97A',
}

/** The dark well a ghost is mixed toward. */
const WELL_DARK = '#1E1E2E'
/** How far a ghost color is from the dark well toward its piece color. */
const GHOST_STRENGTH = 0.55

const channelsOf = (color: string) => [1, 3, 5].map(at => Number.parseInt(color.slice(at, at + 2), 16))
const hex = (channels: number[]) => `#${channels.map(channel => channel.toString(16).padStart(2, '0')).join('').toUpperCase()}`

/** `color` mixed toward `base`: 0 is the base, 1 the color. */
function toward(color: string, base: string, strength: number): Color {
  const from = channelsOf(base)

  return hex(channelsOf(color).map((channel, at) => Math.round(from[at]! + (channel - from[at]!) * strength))) as Color
}

/**
 * Each piece's ghost color: its own color at reduced intensity, so the ghost
 * reads as that piece but never as a locked one. Not dimColor: Claude Code
 * draws dim text grey, whatever its color.
 */
export const GHOST_COLORS: Readonly<Record<Kind, Color>> = Object.fromEntries(
  Object.entries(PIECE_COLORS).map(([kind, color]) => [kind, toward(String(color), WELL_DARK, GHOST_STRENGTH)]),
) as Record<Kind, Color>

export const COLORS = {
  /** The well's frame and the side boxes: the game's own accent. */
  frame: '#7A6FB0',
  /** The dots of an empty cell. */
  grid: 'subtle',
  /** Panel labels: hold, next, score. */
  label: 'inactive',
  /** Panel numbers. */
  value: 'text',
  /** A card over the well: its background and its text. */
  card: '#2A2540',
  cardText: 'text',
  /** Cleared rows, as they flash before they go. */
  flash: '#FFF4DC',
  /** The word a clear is called in the well's top edge. */
  callout: '#FFD479',
  /** The status line while the game has the keys. */
  keys: 'success',
  /** The status line while the keys go to the prompt: the warning that Escape there interrupts Claude. */
  away: 'warning',
} as const satisfies Record<string, Color>
