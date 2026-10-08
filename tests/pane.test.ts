import { describe, expect, test, tier } from 'claude-code/testing'

import Play from '../hooks/play'
import { COMMAND, PANE, PLUGIN, SESSION, ghostColumn, inSession, mounted, paneProps, statusOf, wellLines, wellStrings } from './fixtures/pane'

tier('user')

const CLICK = { type: 'down', x: 30, y: 10, button: 'left' } as const
const AWAY_STATUS = 'click to play · or ctrl+x tab, then w a s d'

/** Hard drops until the game-over card shows (plain or new best, both offer to play again); how many it took, or -1. */
async function dropUntilOver(ui: Awaited<ReturnType<typeof mounted>>): Promise<number> {
  for (let drops = 1; drops <= 200; drops++) {
    // space and x in turn: two different keys are taps, never one held key
    await ui.key({ key: drops % 2 === 0 ? 'space' : 'x' })
    if ((await wellLines(ui)).some(line => line.includes('play again'))) {
      return drops
    }
  }

  return -1
}

describe('opening the pane', () => {
  test('/line-clear opens the pane without taking the keys and says nothing to the transcript', async ($, on) => {
    const { opened } = inSession(on)
    await $.session.start(SESSION)
    const result = await $.command.run(COMMAND)

    expect(opened).toEqual([{ id: PANE, title: 'line-clear', rows: 23, columns: 50 }])
    expect(result.text).toBeUndefined()
  })

  test('the pane draws the game region, waiting for a click, and the legend of hotkey Buttons', async ($, on) => {
    inSession(on)
    const ui = await mounted($)

    expect(await statusOf(ui)).toBe(AWAY_STATUS)
    expect((await wellLines(ui)).some(line => line.includes('click to play  '))).toBe(true)
    const buttons = await ui.findAll({ type: 'Button' })
    expect(buttons.map(button => [button.props.hotkey, button.props.label])).toEqual([
      ['a', 'left'],
      ['d', 'right'],
      ['w', 'turn'],
      ['q', 'turn back'],
      ['s', 'down'],
      ['x', 'drop'],
      ['c', 'hold'],
      ['p', 'pause'],
    ])
  })

  test('a surface with no game region says where the game plays', async ($, on) => {
    inSession(on)
    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'vscode', component: 'Pane', requestId: PANE, props: paneProps() })

    expect((await ui.find({ type: 'Text' }))?.text).toBe('line-clear plays in the terminal and the desktop app.')
  })
})

describe('the click path', () => {
  test('a click starts the game and gives the region the keys; left and right move the piece', async ($, on) => {
    inSession(on)
    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', requestId: PANE, props: paneProps() })
      await ui.pointer(CLICK)
      expect(await statusOf(ui), surface).toBe('playing · Esc gives keys back')
      const start = await ghostColumn(ui)
      expect(start, surface).toBeGreaterThan(0)

      await ui.key({ key: 'left' })
      expect(await ghostColumn(ui), surface).toBe(start - 2)
      await ui.key({ key: 'right' })
      await ui.key({ key: 'right' })
      expect(await ghostColumn(ui), surface).toBe(start + 2)
      await ui.unmount()
    }
  })

  test('keys before any click start no game: the card still says click to play', async ($, on) => {
    inSession(on)
    const ui = await mounted($)
    await ui.key({ key: 'space' })
    await ui.key({ key: 'p' })

    expect(await ghostColumn(ui)).toBe(-1)
    expect((await wellLines(ui)).some(line => line.includes('click to play  '))).toBe(true)
  })

  test('a burst that arrives as one event moves once per key', async ($, on) => {
    inSession(on)
    const ui = await mounted($)
    await ui.pointer(CLICK)
    const start = await ghostColumn(ui)
    await ui.key({ key: 'aa' })

    expect(await ghostColumn(ui)).toBe(start - 4)
  })

  test('two seconds with no key and the game pauses, showing click to play; any key resumes it', async ($, on) => {
    inSession(on)
    const ui = await mounted($)
    await ui.pointer(CLICK)
    await ui.advance(1_950)
    expect(await statusOf(ui)).toBe('playing · Esc gives keys back')

    await ui.advance(50)
    expect(await statusOf(ui)).toBe(AWAY_STATUS)
    expect((await wellLines(ui)).some(line => line.includes('click to play  '))).toBe(true)
    const paused = await wellLines(ui)
    await ui.advance(5_000)
    expect(await wellLines(ui), 'gravity stopped').toEqual(paused)

    await ui.key({ key: 'k' })
    expect(await statusOf(ui)).toBe('playing · Esc gives keys back')
  })

  test('the game-over card shows the final score, and a click plays again', async ($, on) => {
    inSession(on)
    const ui = await mounted($)
    await ui.pointer(CLICK)
    expect(await dropUntilOver(ui)).toBeGreaterThan(0)
    const lines = await wellLines(ui)
    const score = lines.map(line => /score (\d+)/.exec(line)?.[1]).find(found => found !== undefined)
    expect(Number(score)).toBeGreaterThan(0)
    expect(lines.some(line => line.includes('click to play again'))).toBe(true)

    await ui.key({ key: 'space' })
    expect((await wellLines(ui)).some(line => line.includes('play again')), 'a key does not restart').toBe(true)
    await ui.pointer(CLICK)
    const again = await wellLines(ui)
    expect(again.some(line => line.includes('play again'))).toBe(false)
    expect(again[7]?.trim().split(/\s+/)[0]).toBe('0')
  })

  test('control characters and escape sequences sent as keys are never drawn and never unmount the region', async ($, on) => {
    inSession(on)
    const ui = await mounted($)
    await ui.pointer(CLICK)
    for (const key of ['\u001b[A', '\u0003', 'a\u0000d', '\u007f', '\u009b2J', 'tab']) {
      await ui.key({ key })
    }
    await ui.advance(500)

    const strings = await wellStrings(ui)
    expect(strings.length).toBeGreaterThan(0)
    expect(strings.filter(text => /[\u0000-\u001f\u007f-\u009f]/.test(text))).toEqual([])
    expect(await statusOf(ui)).toBe('playing · Esc gives keys back')
  })
})

describe('the keyboard path: pane hotkeys', () => {
  test('with the pane focused, p starts a game and a moves the piece exactly once, across redraws', async ($, on) => {
    inSession(on)
    const ui = await mounted($, 80, true)
    expect(await statusOf(ui)).toBe('keys: w a s d · Esc gives keys back')
    expect((await wellLines(ui)).some(line => line.includes('p to play'))).toBe(true)

    await ui.press({ key: 'hotkey-p' })
    const start = await ghostColumn(ui)
    expect(start).toBeGreaterThan(0)
    await ui.press({ key: 'hotkey-a' })
    expect(await ghostColumn(ui)).toBe(start - 2)
    await ui.redraw()
    await ui.redraw(paneProps(80, true))
    await ui.advance(200)
    expect(await ghostColumn(ui)).toBe(start - 2)
    await ui.press({ key: 'hotkey-d' })
    await ui.press({ key: 'hotkey-d' })
    expect(await ghostColumn(ui)).toBe(start + 2)
  })

  test('the focused pane never goes idle; when it lets go the game pauses, and it resumes when focused again', async ($, on) => {
    inSession(on)
    const ui = await mounted($, 80, true)
    await ui.press({ key: 'hotkey-p' })
    await ui.advance(10_000)
    expect(await statusOf(ui)).toBe('keys: w a s d · Esc gives keys back')

    await ui.redraw(paneProps(80, false))
    await ui.advance(50)
    expect(await statusOf(ui)).toBe(AWAY_STATUS)
    expect((await wellLines(ui)).some(line => line.includes('click to play  '))).toBe(true)
    const away = await wellLines(ui)
    await ui.advance(3_000)
    expect(await wellLines(ui), 'gravity stopped').toEqual(away)

    await ui.redraw(paneProps(80, true))
    await ui.advance(50)
    expect(await statusOf(ui)).toBe('keys: w a s d · Esc gives keys back')
    expect((await wellLines(ui)).some(line => line.includes('click to play'))).toBe(false)
  })

  test('presses made before the region mounted are not replayed into a new game', async ($, on) => {
    inSession(on)
    const first = await mounted($, 80, true)
    await first.press({ key: 'hotkey-p' })
    await first.press({ key: 'hotkey-a' })
    await first.unmount()

    const second = await mounted($, 80, true)
    expect((await wellLines(second)).some(line => line.includes('p to play'))).toBe(true)
    expect(await ghostColumn(second)).toBe(-1)
  })
})

describe('the best score', () => {
  test('a game that beats the best is saved as a number and shown in the next game', async ($, on) => {
    const { store } = inSession(on, { best: 3 })
    const ui = await mounted($)
    expect((await wellLines(ui))[16]?.trim().split(/\s+/)[0]).toBe('3')
    await ui.pointer(CLICK)
    await dropUntilOver(ui)
    const score = Number((await wellLines(ui))[7]?.trim().split(/\s+/)[0])
    expect(score).toBeGreaterThan(3)
    await ui.advance(100)
    const lines = await wellLines(ui)
    expect(lines.some(line => line.includes(`up ${score - 3} on 3`))).toBe(true)
    await ui.unmount()

    expect(store.get('best')).toBe(score)
    expect(lines.some(line => line.includes('new best')), 'the card still calls it a new best once it is saved').toBe(true)
    const next = await mounted($)
    expect((await wellLines(next))[16]?.trim().split(/\s+/)[0]).toBe(String(score))
  })

  test('a game below the best leaves it alone', async ($, on) => {
    const { store } = inSession(on, { best: 1_000_000 })
    const ui = await mounted($)
    await ui.pointer(CLICK)
    await dropUntilOver(ui)

    expect(store.get('best')).toBe(1_000_000)
    expect((await wellLines(ui))[16]?.trim().split(/\s+/)[0]).toBe('1000000')
    expect((await wellLines(ui)).some(line => line.includes('game over'))).toBe(true)
    expect((await wellLines(ui)).some(line => line.includes('new best'))).toBe(false)
  })

  test('an ended game is handed to the hooks module once, however long the card shows', async ($, on) => {
    const { store, reads } = inSession(on)
    const ui = await mounted($)
    await ui.pointer(CLICK)
    await dropUntilOver(ui)
    await ui.advance(100)
    const score = store.get('best')
    expect(typeof score).toBe('number')
    const settled = reads.length
    await ui.advance(2_000)

    // each post makes the hooks module read the best again: none while the card shows
    expect(reads.length - settled).toBe(0)
  })

  test('a stored best that is not a number reads as none, and a forged post is ignored', async ($, on) => {
    const { store } = inSession(on, { best: 'lots' })
    const ui = await mounted($)
    expect((await wellLines(ui))[16]?.trim().split(/\s+/)[0]).toBe('0')
    await ui.post({ kind: 'over', score: 'lots' }, { in: 'well' })
    await ui.post({ kind: 'over', score: 1.5 }, { in: 'well' })

    expect(store.get('best')).toBe('lots')
  })
})

describe('the region at 80 and 120 columns', () => {
  test('it lays out at its measured width: centred, and no line wider than the region', async ($, on) => {
    inSession(on)
    for (const columns of [80, 120]) {
      const ui = await mounted($, 80)
      await ui.resize({ columns, rows: 23, in: 'well' })
      await ui.pointer(CLICK)
      await ui.key({ key: 'aac' })
      const lines = await wellLines(ui)
      const margin = Math.floor((columns - 46) / 2)

      expect(lines.length, `${columns}`).toBe(21)
      expect(lines[0], `${columns}`).toBe(`${' '.repeat(margin)}hold  used  ╭────────────────────╮  next`)
      expect(lines.filter(line => line.length > columns), `${columns}`).toEqual([])
      await ui.unmount()
    }
  })

  test('the legend rows line up with the region and fit the pane', async ($, on) => {
    inSession(on)
    for (const columns of [80, 120]) {
      const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PANE, props: paneProps(columns) })
      const rows = (await ui.findAll({ type: 'Box' })).filter(box => String(box.key ?? '').startsWith('legend-'))
      const margin = Math.floor((columns - 46) / 2)

      expect(rows.map(row => row.props.paddingLeft), `${columns}`).toEqual([margin, margin])
      // plain Buttons draw as "a: left", two columns apart
      const widths = [['left', 'right', 'turn', 'turn back'], ['down', 'drop', 'hold', 'pause']].map(labels => labels.reduce((sum, label) => sum + 3 + label.length, 0) + 2 * 3)
      expect(widths.every(width => margin + width <= columns), `${columns}`).toBe(true)
      await ui.unmount()
    }
  })
})

describe('the startLevel setting', () => {
  const levelShown = async (ui: Awaited<ReturnType<typeof mounted>>) => (await wellLines(ui))[10]?.trim().split(/\s+/)[0]

  test('by default a game starts at level 1', async ($, on) => {
    inSession(on)
    const ui = await mounted($)
    await ui.pointer(CLICK)
    expect(await levelShown(ui)).toBe('1')
  })

  test('set to 7, each game starts at level 7 and falls at its speed', { options: { startLevel: 7 } }, async ($, on) => {
    inSession(on)
    const ui = await mounted($)
    await ui.pointer(CLICK)
    expect(await levelShown(ui)).toBe('7')
    // level 7 falls a row each (0.8 - 6 * 0.007) ^ 6 s = 190 ms: a second brings it down 5 rows, where level 1 brings 1
    const top = (await wellLines(ui)).findLastIndex(line => line.slice(30, 50).includes('█'))
    await ui.advance(1_000)
    const after = (await wellLines(ui)).findLastIndex(line => line.slice(30, 50).includes('█'))
    expect(after - top).toBe(5)
  })

  test('a level that is not a whole number from 1 to 15 reads as 1', async ($, on) => {
    for (const startLevel of [0, 2.5, 16, -3]) {
      expect(Play.startLevelOf(startLevel), String(startLevel)).toBe(1)
    }
    expect(Play.startLevelOf(15)).toBe(15)
    expect(Play.startLevelOf('5')).toBe(1)
  })
})

