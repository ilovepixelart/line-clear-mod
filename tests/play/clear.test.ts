import { describe, expect, test, tier } from 'claude-code/testing'

import Game from '../../hooks/game'
import Play from '../../hooks/play'
import type { GameState, Piece } from '../../hooks/game'
import type { Play as PlayState } from '../../hooks/play'
import { boardFrom } from '../fixtures/board'
import { gameWith } from '../fixtures/game'

tier('user')

const AWAY = { paneFocused: false, seedBase: 0, best: 0 }
const CLICK = { type: 'down', x: 0, y: 0 } as const

/** A clicked region at time 0 playing `game`. */
const playing = (game: GameState): PlayState => ({ ...Play.pointed(Play.startPlay(0), CLICK, AWAY), game })

/** A clicked region at time 0 whose falling piece is an I over `rows` rows of nine cells, open in column 9, under the `above` rows. */
function readyToClear(rows: number, above: string[] = [], extra: Partial<GameState> = {}): PlayState {
  return playing(gameWith('I', boardFrom(...above, ...Array.from({ length: rows }, () => '#########.')), extra))
}

/** The I stood up, taken to column 9 and hard dropped: it fills the open column and clears `rows` rows. */
const cleared = (rows: number, above: string[] = [], extra: Partial<GameState> = {}) => Play.keyed(readyToClear(rows, above, extra), { key: 'wddddx' }, AWAY)
/** A row with one cell, left above the cleared rows so a clear does not empty the well. */
const CELL_ABOVE = ['#.........']

function frames(play: PlayState, count: number): PlayState {
  let current = play
  for (let at = 0; at < count; at++) {
    current = Play.ticked(current, AWAY)
  }

  return current
}

/** The game drawn at its own width, so the well starts after the hold panel and the gap. */
const screen = (play: PlayState) => Play.screenOf(play, AWAY, Play.GAME_COLUMNS)
const WELL_AT = 12
/** The well's inner text, visible row by visible row. */
const wellRows = (play: PlayState) => screen(play).slice(1, 1 + Game.VISIBLE_ROWS).map(line => Play.textOf(line).slice(WELL_AT + 1, WELL_AT + 21))
const wellTop = (play: PlayState) => Play.textOf(screen(play)[0]!).slice(WELL_AT, WELL_AT + 22)
const wellBottom = (play: PlayState) => Play.textOf(screen(play)[1 + Game.VISIBLE_ROWS]!).slice(WELL_AT, WELL_AT + 22)
const PLAIN_TOP = `╭${'─'.repeat(20)}╮`
const PLAIN_BOTTOM = `╰${'─'.repeat(20)}╯`
const litSegments = (play: PlayState) => screen(play).flat().filter(segment => segment.color === Play.COLORS.flash)

const I_LEFT = '· · · · · · · · · ██'

describe('a line clear on the frame clock', () => {
  test('while the rows clear (200 ms, four frames) they light up whole, then empty from the middle out', () => {
    const play = cleared(2)
    expect(play.game!.lines).toBe(2)
    const bottom = (at: number) => wellRows(frames(play, at)).slice(-4)
    // a pair of columns goes every 40 ms: 0, 1, 2 and 3 pairs gone at 0, 50, 100 and 150 ms
    expect(bottom(0)).toEqual([I_LEFT, I_LEFT, '████████████████████', '████████████████████'])
    expect(bottom(1).slice(2)).toEqual(['████████· · ████████', '████████· · ████████'])
    expect(bottom(2).slice(2)).toEqual(['██████· · · · ██████', '██████· · · · ██████'])
    expect(bottom(3).slice(2)).toEqual(['████· · · · · · ████', '████· · · · · · ████'])
    expect(litSegments(frames(play, 0)).length).toBeGreaterThan(0)
  })

  test('no piece moves over the clearing rows: the next one enters when they are gone', () => {
    const play = cleared(2)
    for (const at of [0, 1, 2, 3]) {
      expect(frames(play, at).game!.active, `frame ${at}`).toBeNull()
      expect(wellRows(frames(play, at)).slice(0, 4).every(row => !row.includes(Play.CELL)), `frame ${at}`).toBe(true)
    }
    expect(frames(play, 4).game!.active).not.toBeNull()
  })

  test('after four frames (200 ms) the well shows the rows gone and what was above them fallen', () => {
    const after = frames(cleared(2), 4)
    // column 9 holds the rest of the I; the next piece's ghost may lie elsewhere on these rows
    expect(wellRows(after).slice(-4).map(row => row.slice(-2))).toEqual(['· ', '· ', '██', '██'])
    expect(wellRows(after).slice(-4).every(row => !row.includes(Play.CELL.repeat(2)))).toBe(true)
    expect(litSegments(after)).toEqual([])
  })

  test('a lock that clears nothing lights nothing and calls nothing out', () => {
    const play = Play.keyed(readyToClear(2), { key: 'x' }, AWAY)
    expect(play.game!.lines).toBe(0)
    expect(litSegments(play)).toEqual([])
    expect(wellTop(play)).toBe(`╭${'─'.repeat(20)}╮`)
  })

  test('a drop pressed while the rows clear does nothing; once they are gone the ghost is back', () => {
    const pressed = Play.keyed(frames(cleared(2), 1), { key: 'space' }, AWAY)
    expect(pressed.game!.score).toBe(cleared(2).game!.score)
    const after = frames(pressed, 3)
    expect(litSegments(after)).toEqual([])
    expect(screen(after).flat().some(segment => segment.text.includes(Play.GHOST)), 'the ghost is back').toBe(true)
  })

  test('a clear by the lock delay on the frame clock flashes too', () => {
    const resting = Play.keyed(readyToClear(2), { key: `wdddd${'s'.repeat(19)}` }, AWAY)
    expect(resting.game!.lines).toBe(0)
    const locked = frames(resting, 10)
    expect(locked.game!.lines).toBe(2)
    expect(litSegments(locked).length).toBeGreaterThan(0)
    expect(wellTop(locked)).toBe('╭────── double ──────╮')
  })

  test('a clear from the pane\'s hotkeys flashes too', () => {
    const PANE = { ...AWAY, paneFocused: true }
    const play = { ...readyToClear(2), region: false }
    const keys = ['w', 'd', 'd', 'd', 'd', 'x']
    const pressed = Play.pressed(play, keys.map((key, at) => ({ seq: at + 1, key })), PANE)
    expect(pressed.game!.lines).toBe(2)
    expect(Play.screenOf(pressed, PANE, Play.GAME_COLUMNS).flat().some(segment => segment.color === Play.COLORS.flash)).toBe(true)
  })
})

describe('the callout', () => {
  test('one to four rows are called single, double, triple and four at once!, in the well\'s top edge', () => {
    expect([1, 2, 3, 4].map(rows => wellTop(cleared(rows, CELL_ABOVE)))).toEqual([
      '╭────── single ──────╮',
      '╭────── double ──────╮',
      '╭────── triple ──────╮',
      '╭── four at once! ───╮',
    ])
  })

  test('it stays 1.5 seconds on the frame clock, through the next lock, and then the edge is plain again', () => {
    const play = Play.keyed(cleared(3), { key: 'x' }, AWAY)
    expect(wellTop(frames(play, 29))).toBe('╭────── triple ──────╮')
    expect(wellTop(frames(play, 30))).toBe(`╭${'─'.repeat(20)}╮`)
  })

  test('a clear that empties the well is called all clear!', () => {
    expect(wellTop(cleared(4))).toBe('╭──── all clear! ────╮')
  })

  test('a spin is called by its kind and rows: spin double, mini spin single, and spin with no rows', () => {
    const aboveSlot: Piece = { kind: 'T', rotation: 1, x: 3, y: 19 }
    const spun = (board: string[], active: Piece) => Play.keyed(playing(gameWith('T', boardFrom(...board), { active, lowestY: 21 })), { key: 'wx' }, AWAY)
    expect(wellTop(spun(['####......', '###...####', '####.#####'], aboveSlot))).toBe('╭─── spin double ────╮')
    expect(wellTop(spun(['####......', '###...###.', '####.####.'], aboveSlot))).toBe('╭─────── spin ───────╮')
    expect(wellTop(spun(['..........', '.#########'], { kind: 'T', rotation: 0, x: 0, y: 19 }))).toBe('╭─ mini spin single ─╮')
  })

  test('back to back and a combo are called in the well\'s bottom edge', () => {
    expect(wellBottom(cleared(4, CELL_ABOVE, { backToBack: true }))).toBe('╰─── back to back ───╯')
    expect(wellBottom(cleared(1, CELL_ABOVE, { combo: 2 }))).toBe('╰───── combo 3 ──────╯')
    expect(wellBottom(cleared(1, CELL_ABOVE))).toBe(PLAIN_BOTTOM)
  })

  test('when the full words do not fit the bottom edge, back to back is called b2b', () => {
    expect(wellBottom(cleared(4, CELL_ABOVE, { backToBack: true, combo: 1 }))).toBe('╰── b2b · combo 2 ───╯')
  })

  test('extras that just fit the edge are all shown', () => {
    // ' combo 12 · level 3 ' is exactly the 20 columns of the edge
    expect(wellBottom(cleared(1, CELL_ABOVE, { combo: 11, lines: 19, level: 2 }))).toBe('╰ combo 12 · level 3 ╯')
  })

  test('a clear that takes the game up a level calls the new level in the bottom edge', () => {
    expect(wellBottom(cleared(1, CELL_ABOVE, { lines: 9 }))).toBe('╰───── level 2 ──────╯')
  })

  test('a new game starts with no callout', () => {
    const over = { ...cleared(2), game: { ...cleared(2).game!, phase: 'over' as const, active: null } }
    expect(wellTop(Play.pointed(over, CLICK, AWAY))).toBe(PLAIN_TOP)
  })
})
