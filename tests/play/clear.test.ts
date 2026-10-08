import { describe, expect, test, tier } from 'claude-code/testing'

import Game from '../../hooks/game'
import Play from '../../hooks/play'
import type { Play as PlayState } from '../../hooks/play'
import { boardFrom } from '../fixtures/board'
import { gameWith } from '../fixtures/game'

tier('user')

const AWAY = { paneFocused: false, seedBase: 0, best: 0 }
const CLICK = { type: 'down', x: 0, y: 0 } as const

/** A clicked region at time 0 whose falling piece is an I over `rows` rows of nine cells, open in column 9. */
function readyToClear(rows: number): PlayState {
  const clicked = Play.pointed(Play.startPlay(0), CLICK, AWAY)

  return { ...clicked, game: gameWith('I', boardFrom(...Array.from({ length: rows }, () => '#########.'))) }
}

/** The I stood up, taken to column 9 and hard dropped: it fills the open column and clears `rows` rows. */
const cleared = (rows: number) => Play.keyed(readyToClear(rows), { key: 'wddddx' }, AWAY)

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
const litSegments = (play: PlayState) => screen(play).flat().filter(segment => segment.color === Play.COLORS.flash)

const I_LEFT = '· · · · · · · · · ██'

describe('a line clear on the frame clock', () => {
  test('the cleared rows light up whole, then empty from the middle out, a pair of columns a frame', () => {
    const play = cleared(2)
    expect(play.game!.lines).toBe(2)
    const bottom = (at: number) => wellRows(frames(play, at)).slice(-4)
    expect(bottom(0)).toEqual([I_LEFT, I_LEFT, '████████████████████', '████████████████████'])
    expect(bottom(1).slice(2)).toEqual(['████████· · ████████', '████████· · ████████'])
    expect(bottom(2).slice(2)).toEqual(['██████· · · · ██████', '██████· · · · ██████'])
    expect(bottom(3).slice(2)).toEqual(['████· · · · · · ████', '████· · · · · · ████'])
    expect(bottom(4).slice(2)).toEqual(['██· · · · · · · · ██', '██· · · · · · · · ██'])
    expect(litSegments(frames(play, 0)).length).toBeGreaterThan(0)
  })

  test('after five frames (250 ms) the well shows the rows gone and what was above them fallen', () => {
    const after = frames(cleared(2), 5)
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

  test('the next lock ends the flash: a drop mid-flash shows the board as it is', () => {
    const next = Play.keyed(frames(cleared(2), 1), { key: 'space' }, AWAY)
    expect(litSegments(next)).toEqual([])
    expect(wellRows(next).slice(-2)).not.toContain('████████████████████')
    expect(screen(next).flat().some(segment => segment.text.includes(Play.GHOST)), 'the ghost is back').toBe(true)
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
    expect([1, 2, 3, 4].map(rows => wellTop(cleared(rows)))).toEqual([
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

  test('a new game starts with no callout', () => {
    const over = { ...cleared(2), game: { ...cleared(2).game!, phase: 'over' as const, active: null } }
    expect(wellTop(Play.pointed(over, CLICK, AWAY))).toBe(`╭${'─'.repeat(20)}╮`)
  })
})
