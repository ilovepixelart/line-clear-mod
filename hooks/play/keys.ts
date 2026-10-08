import type { ClientKeyEvent } from 'claude-code'

import type { Input } from '../game'

/**
 * The keyboard controls, one lowercase letter each: what a pane Button's
 * `hotkey` may be, so the same letters work with the pane focused (ctrl+x
 * tab) and with the game region clicked. In legend order.
 */
export const HOTKEYS: readonly { readonly key: string; readonly input: Input; readonly label: string }[] = [
  { key: 'a', input: 'left', label: 'left' },
  { key: 'd', input: 'right', label: 'right' },
  { key: 'w', input: 'rotateCw', label: 'turn' },
  { key: 'q', input: 'rotateCcw', label: 'turn back' },
  { key: 's', input: 'softDrop', label: 'down' },
  { key: 'x', input: 'hardDrop', label: 'drop' },
  { key: 'c', input: 'hold', label: 'hold' },
  { key: 'p', input: 'pause', label: 'pause' },
]

/** The keys only a clicked game region receives: arrows and Space, which a focused pane keeps for itself. */
const REGION_KEYS: Readonly<Record<string, Input>> = {
  left: 'left',
  right: 'right',
  up: 'rotateCw',
  down: 'softDrop',
  space: 'hardDrop',
  ' ': 'hardDrop',
  z: 'rotateCcw',
}

const LETTERS: Readonly<Record<string, Input>> = Object.fromEntries(HOTKEYS.map(({ key, input }) => [key, input]))

/**
 * The special keys the surface reports by name: each is one key, never a
 * burst of letters (`tab` is not t, a, b, which would move the piece left).
 */
const NAMED = new Set([
  'left', 'right', 'up', 'down', 'space', 'return', 'enter', 'tab', 'backspace', 'delete', 'insert', 'escape',
  'pageup', 'pagedown', 'home', 'end',
  ...Array.from({ length: 24 }, (_, at) => `f${at + 1}`),
])

const CONTROL = /[\u0000-\u001f\u007f-\u009f]/

/** One key's input: a named key, or a letter in either case; undefined for every other key. */
function inputOfOne(key: string): Input | undefined {
  const lower = key.toLowerCase()

  return REGION_KEYS[key] ?? REGION_KEYS[lower] ?? LETTERS[lower]
}

/**
 * The inputs a key event to the clicked game region stands for, in order.
 * Keys typed fast can arrive as one event (`key: "wasd"`), so a key that is
 * not a named key is read one character at a time. A key held with ctrl or
 * meta is a shortcut, not a move, and stands for nothing; so does a key
 * holding a control character, and any key the game has no use for.
 */
export function inputsOfKey(event: ClientKeyEvent): Input[] {
  // a control character means a raw escape sequence: its printable tail (`[A`) is not a burst of letters
  if (event.ctrl === true || event.meta === true || CONTROL.test(event.key)) {
    return []
  }
  const keys = NAMED.has(event.key) ? [event.key] : [...event.key]

  return keys.flatMap(key => inputOfOne(key) ?? [])
}

/** The input a pane Button's hotkey stands for; undefined for a key that is not one. */
export function inputOfHotkey(key: string): Input | undefined {
  return LETTERS[key]
}
