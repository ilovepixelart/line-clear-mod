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

  test('a shifted letter is the same control', () => {
    expect(Play.inputsOfKey({ key: 'A', shift: true })).toEqual(['left'])
    expect(Play.inputsOfKey({ key: 'X', shift: true })).toEqual(['hardDrop'])
    expect(Play.inputsOfKey({ key: 'Z', shift: true })).toEqual(['rotateCcw'])
  })

  test('a burst that arrives as one event is split into its keys, in order', () => {
    expect(Play.inputsOfKey({ key: 'wasd' })).toEqual(['rotateCw', 'left', 'softDrop', 'right'])
    expect(Play.inputsOfKey({ key: 'aa x' })).toEqual(['left', 'left', 'hardDrop', 'hardDrop'])
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
