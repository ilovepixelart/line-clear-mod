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
  /** The status line while the game has the keys. */
  keys: 'success',
  /** The status line while the keys go to the prompt: the warning that Escape there interrupts Claude. */
  away: 'warning',
} as const satisfies Record<string, Color>
