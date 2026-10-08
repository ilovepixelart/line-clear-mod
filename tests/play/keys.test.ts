import { describe, expect, test, tier } from 'claude-code/testing'

import Play from '../../hooks/play'

tier('user')

describe('keys on the clicked game region', () => {
  test('arrows move, turn and drop; space drops hard; z turns back', () => {
    expect(Play.inputsOfKey({ key: 'left' })).toEqual(['left'])
    expect(Play.inputsOfKey({ key: 'right' })).toEqual(['right'])
    expect(Play.inputsOfKey({ key: 'up' })).toEqual(['rotateCw'])
    expect(Play.inputsOfKey({ key: 'down' })).toEqual(['softDrop'])
    expect(Play.inputsOfKey({ key: 'space' })).toEqual(['hardDrop'])
    expect(Play.inputsOfKey({ key: ' ' })).toEqual(['hardDrop'])
    expect(Play.inputsOfKey({ key: 'z' })).toEqual(['rotateCcw'])
  })

  test('the letters are the pane hotkeys: a d w q s x c p', () => {
    const letters = 'adwqsxcp'
    expect([...letters].map(key => Play.inputsOfKey({ key }))).toEqual([
      ['left'],
      ['right'],
      ['rotateCw'],
      ['rotateCcw'],
      ['softDrop'],
      ['hardDrop'],
      ['hold'],
      ['pause'],
    ])
  })

  test('a shifted letter is the same control, except A and D, which slide to the wall', () => {
    expect(Play.inputsOfKey({ key: 'X', shift: true })).toEqual(['hardDrop'])
    expect(Play.inputsOfKey({ key: 'Z', shift: true })).toEqual(['rotateCcw'])
    expect(Play.inputsOfKey({ key: 'A', shift: true })).toEqual(['slideLeft'])
    expect(Play.inputsOfKey({ key: 'D', shift: true })).toEqual(['slideRight'])
    expect(Play.inputsOfKey({ key: 'Aa' })).toEqual(['slideLeft', 'left'])
  })

  test('shift with left or right slides to the wall', () => {
    expect(Play.inputsOfKey({ key: 'left', shift: true })).toEqual(['slideLeft'])
    expect(Play.inputsOfKey({ key: 'right', shift: true })).toEqual(['slideRight'])
  })

  test('a burst that arrives as one event is split into its keys, in order', () => {
    expect(Play.inputsOfKey({ key: 'wasd' })).toEqual(['rotateCw', 'left', 'softDrop', 'right'])
  })

  test('a burst keeps its known keys and drops the unknown ones', () => {
    expect(Play.inputsOfKey({ key: 'a1?d' })).toEqual(['left', 'right'])
  })

  test('a special key reported by name is one key, never its letters', () => {
    for (const key of ['tab', 'backspace', 'delete', 'pageup', 'pagedown', 'home', 'end', 'return', 'escape', 'f5']) {
      expect(Play.inputsOfKey({ key }), key).toEqual([])
    }
  })

  test('unknown keys and control characters stand for nothing', () => {
    for (const key of ['1', 'k', 'é', '\u0003', '\u001b[A', '']) {
      expect(Play.inputsOfKey({ key }), JSON.stringify(key)).toEqual([])
    }
  })

  test('a key held with ctrl or meta is a shortcut, not a move', () => {
    expect(Play.inputsOfKey({ key: 'a', ctrl: true })).toEqual([])
    expect(Play.inputsOfKey({ key: 'left', meta: true })).toEqual([])
  })
})

describe('a held key', () => {
  /** The inputs of key events, each at its time, read in order with what came before. */
  function pressed(events: readonly [string, number][]): string[][] {
    let last: Play.LastKey = null
    return events.map(([key, at]) => {
      const read = Play.pressesOf({ key }, last, at)
      last = read.last
      return read.inputs
    })
  }

  test('a hard drop held down drops once: its repeats come 120 ms apart or less', () => {
    expect(pressed([['x', 0], ['x', 30], ['x', 60], ['x', 180]])).toEqual([['hardDrop'], [], [], []])
    expect(pressed([['space', 0], ['space', 50]])).toEqual([['hardDrop'], []])
  })

  test('the same key pressed again after a pause of more than 120 ms counts again', () => {
    expect(pressed([['x', 0], ['x', 121]])).toEqual([['hardDrop'], ['hardDrop']])
  })

  test('turns, hold and pause act once while held; left, right and down repeat', () => {
    for (const key of ['w', 'q', 'up', 'z', 'c', 'p']) {
      expect(pressed([[key, 0], [key, 40], [key, 80]]).map(inputs => inputs.length), key).toEqual([1, 0, 0])
    }
    expect(pressed([['a', 0], ['a', 40], ['a', 80]])).toEqual([['left'], ['left'], ['left']])
    expect(pressed([['right', 0], ['right', 40]])).toEqual([['right'], ['right']])
    expect(pressed([['s', 0], ['s', 40]])).toEqual([['softDrop'], ['softDrop']])
  })

  test('another key ends the hold: the held key counts again after it', () => {
    expect(pressed([['x', 0], ['a', 30], ['x', 60]])).toEqual([['hardDrop'], ['left'], ['hardDrop']])
    expect(pressed([['x', 0], ['k', 30], ['x', 60]])).toEqual([['hardDrop'], [], ['hardDrop']])
  })

  test('a burst of one key is a held key; a burst of different keys is taps', () => {
    expect(pressed([['xxx', 0]])).toEqual([['hardDrop']])
    expect(pressed([['aa x', 0]])).toEqual([['left', 'left', 'hardDrop', 'hardDrop']])
    expect(pressed([['wwaa', 0]])).toEqual([['rotateCw', 'left', 'left']])
  })

  test('a shifted letter is the same key as its lowercase', () => {
    expect(pressed([['x', 0], ['X', 30]])).toEqual([['hardDrop'], []])
  })
})

describe('pane hotkeys', () => {
  test('each hotkey is one lowercase letter, all distinct, in legend order', () => {
    const keys = Play.HOTKEYS.map(hotkey => hotkey.key)
    expect(keys).toEqual(['a', 'd', 'w', 'q', 's', 'x', 'c', 'p'])
    expect(keys.every(key => /^[a-z]$/.test(key))).toBe(true)
  })

  test('a hotkey stands for the same input as the letter on the clicked region', () => {
    for (const { key } of Play.HOTKEYS) {
      expect([Play.inputOfHotkey(key)], key).toEqual(Play.inputsOfKey({ key }))
    }
    expect(Play.inputOfHotkey('z')).toBeUndefined()
    expect(Play.inputOfHotkey('space')).toBeUndefined()
  })
})
