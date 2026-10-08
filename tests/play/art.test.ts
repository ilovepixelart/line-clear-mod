import { describe, expect, test, tier } from 'claude-code/testing'

import Game from '../../hooks/game'
import Play from '../../hooks/play'
import type { Line, Outside, Play as PlayState } from '../../hooks/play'
import { ansi256, closestPair, rgbOf } from '../fixtures/color'
import type { Rgb } from '../fixtures/color'

tier('user')

/** The hue angle of a color, 0 to 360. */
function hueOf([r, g, b]: Rgb): number {
  const [max, min] = [Math.max(r, g, b), Math.min(r, g, b)]
  if (max === min) {
    return 0
  }
  const d = max - min
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4

  return (h * 60 + 360) % 360
}

const AWAY = { paneFocused: false, seedBase: 0, best: 0 }
const PANE = { ...AWAY, paneFocused: true }
const CLICK = { type: 'down', x: 0, y: 0 } as const

const texts = (play: PlayState, outside: Outside & { best: number }, columns: number) => Play.screenOf(play, outside, columns).map(Play.textOf)

function frames(play: PlayState, count: number, outside: Outside = AWAY): PlayState {
  let current = play
  for (let at = 0; at < count; at++) {
    current = Play.ticked(current, outside)
  }

  return current
}

/** Seed 0: a drop, three steps left and a hold, then 25 frames (1250 ms) of gravity. */
function midGame(): PlayState {
  const clicked = Play.pointed(Play.startPlay(0), CLICK, AWAY)

  return frames(Play.keyed(Play.keyed(clicked, { key: 'x' }, AWAY), { key: 'aaac' }, AWAY), 25)
}

function toppedOut(play: PlayState): PlayState {
  let current = play
  for (let drops = 0; drops < 200 && current.game?.phase !== 'over'; drops++) {
    // space and x in turn: two different keys are taps, never one held key
    current = Play.keyed(current, { key: drops % 2 === 0 ? ' ' : 'x' }, AWAY)
  }

  return current
}

/** Every state worth drawing: before a game, playing, idle, paused, over, on each focus. */
function everyState(): { label: string; play: PlayState; outside: Outside & { best: number } }[] {
  const mid = midGame()
  const over = toppedOut(mid)

  return [
    { label: 'fresh', play: Play.startPlay(0), outside: AWAY },
    { label: 'fresh, pane', play: Play.startPlay(0), outside: PANE },
    { label: 'mid', play: mid, outside: { ...AWAY, best: 9_999_999 } },
    { label: 'idle', play: frames(mid, 40), outside: AWAY },
    { label: 'paused', play: Play.keyed(mid, { key: 'p' }, AWAY), outside: AWAY },
    { label: 'over', play: over, outside: AWAY },
    { label: 'over, pane', play: { ...over, region: false }, outside: PANE },
  ]
}

describe('the game region at 80 and 120 columns', () => {
  test('before the first game, at 80: an empty well, centred, with the click to play card', () => {
    expect(texts(Play.startPlay(0), AWAY, 80)).toEqual([
    "                 hold        ╭────────────────────╮  next",
    "                 ╭────────╮  │· · · · · · · · · · │  ╭────────╮",
    "                 │        │  │· · · · · · · · · · │  │        │",
    "                 │        │  │· · · · · · · · · · │  │        │",
    "                 ╰────────╯  │· · · · · · · · · · │  │        │",
    "                             │· · · · · · · · · · │  │        │",
    "                 score       │· · · · · · · · · · │  │        │",
    "                 0           │· · · · · · · · · · │  │        │",
    "                             │                    │  │        │",
    "                 level       │   click to play    │  │        │",
    "                 1           │                    │  ╰────────╯",
    "                             │· · · · · · · · · · │",
    "                 lines       │· · · · · · · · · · │",
    "                 0           │· · · · · · · · · · │",
    "                             │· · · · · · · · · · │",
    "                 best        │· · · · · · · · · · │",
    "                 0           │· · · · · · · · · · │",
    "                             │· · · · · · · · · · │",
    "                             │· · · · · · · · · · │",
    "                             ╰────────────────────╯",
    "                 click to play · or ctrl+x tab, then w a s d",
    ])
  })

  test('mid game, at 120: the falling piece, its ghost, the held piece, the next three and the numbers', () => {
    expect(texts(midGame(), { ...AWAY, best: 5000 }, 120)).toEqual([
    "                                     hold  used  ╭────────────────────╮  next",
    "                                     ╭────────╮  │· · · ████· · · · · │  ╭────────╮",
    "                                     │  ██    │  │· · · · ████· · · · │  │██      │",
    "                                     │██████  │  │· · · · · · · · · · │  │██████  │",
    "                                     ╰────────╯  │· · · · · · · · · · │  │        │",
    "                                                 │· · · · · · · · · · │  │    ██  │",
    "                                     score       │· · · · · · · · · · │  │██████  │",
    "                                     34          │· · · · · · · · · · │  │        │",
    "                                                 │· · · · · · · · · · │  │████████│",
    "                                     level       │· · · · · · · · · · │  │        │",
    "                                     1           │· · · · · · · · · · │  ╰────────╯",
    "                                                 │· · · · · · · · · · │",
    "                                     lines       │· · · · · · · · · · │",
    "                                     0           │· · · · · · · · · · │",
    "                                                 │· · · · · · · · · · │",
    "                                     best        │· · · ▓▓▓▓· · · · · │",
    "                                     5000        │· · · · ▓▓▓▓· · · · │",
    "                                                 │· · · · ████· · · · │",
    "                                                 │· · · ████· · · · · │",
    "                                                 ╰────────────────────╯",
    "                                     playing · Esc gives keys back",
    ])
  })

  test('game over, at 80: the card shows the final score and click to play again', () => {
    expect(texts(toppedOut(midGame()), AWAY, 80)).toEqual([
    "                 hold        ╭────────────────────╮  next",
    "                 ╭────────╮  │· · · · · ██· · · · │  ╭────────╮",
    "                 │  ██    │  │· · · ██████· · · · │  │  ████  │",
    "                 │██████  │  │· · · ████████· · · │  │████    │",
    "                 ╰────────╯  │· · · ██· · · · · · │  │        │",
    "                             │· · · ██████· · · · │  │████    │",
    "                 score       │· · · · ████· · · · │  │  ████  │",
    "                 170         │                    │  │        │",
    "                             │    ✧ new best ✧    │  │████████│",
    "                 level       │     score 170      │  │        │",
    "                 1           │                    │  ╰────────╯",
    "                             │click to play again │",
    "                 lines       │                    │",
    "                 0           │· · · ██· · · · · · │",
    "                             │· · · ██████· · · · │",
    "                 best  new!  │· · · ████· · · · · │",
    "                 170         │· · · · ████· · · · │",
    "                             │· · · · ████· · · · │",
    "                             │· · · ████· · · · · │",
    "                             ╰────────────────────╯",
    "                 playing · Esc gives keys back",
    ])
  })

  test('no line is wider than the region, in every state, at the narrowest width that fits, at 80 and at 120', () => {
    for (const columns of [Play.GAME_COLUMNS, 80, 120]) {
      for (const { label, play, outside } of everyState()) {
        const lines = texts(play, outside, columns)
        expect(lines.length, label).toBe(Play.GAME_ROWS)
        for (const line of lines) {
          expect(line.length, `${label} at ${columns}: ${line}`).toBeLessThanOrEqual(columns)
        }
      }
    }
  })

  test('narrower than the game, one line asks for room, and it fits', () => {
    const lines = texts(midGame(), AWAY, Play.GAME_COLUMNS - 1)
    expect(lines).toEqual(['line-clear needs 46 columns: widen the pane'])
    expect(lines[0]!.length).toBeLessThanOrEqual(Play.GAME_COLUMNS - 1)
  })
})

describe('who has the keys, on the status line and the card', () => {
  const statusOf = (play: PlayState, outside: Outside & { best: number }) => texts(play, outside, 80).at(-1)!.trim()
  const cardOf = (play: PlayState, outside: Outside & { best: number }) =>
    Play.screenOf(play, outside, 80)
      .slice(1, -2)
      .flatMap(line => line.filter(segment => segment.backgroundColor !== undefined).map(segment => segment.text.trim()))
      .filter(text => text !== '')

  test('nobody: the status says how to get the keys, in the warning color', () => {
    const line = Play.screenOf(frames(midGame(), 40), AWAY, 80).at(-1)!
    expect(Play.textOf(line).trim()).toBe('click to play · or ctrl+x tab, then w a s d')
    expect(line.at(-1)?.color).toBe('warning')
  })

  test('the clicked region: playing, and how to give the keys back', () => {
    expect(statusOf(midGame(), AWAY)).toBe('playing · Esc gives keys back')
  })

  test('the focused pane: its letters, and how to give the keys back', () => {
    expect(statusOf({ ...midGame(), region: false }, PANE)).toBe('keys: w a s d · Esc gives keys back')
  })

  test('the cards: click to play while nobody has the keys, paused, game over, and the pane path\'s p', () => {
    expect(cardOf(Play.startPlay(0), AWAY)).toEqual(['click to play'])
    expect(cardOf(Play.startPlay(0), PANE)).toEqual(['p to play'])
    expect(cardOf(midGame(), AWAY)).toEqual([])
    expect(cardOf(frames(midGame(), 40), AWAY)).toEqual(['click to play'])
    expect(cardOf(Play.keyed(midGame(), { key: 'p' }, AWAY), AWAY)).toEqual([])
    const over = { ...toppedOut(midGame()), bestBefore: 1_000_000 }
    expect(cardOf(over, AWAY)).toEqual(['game over', `score ${over.game!.score}`, 'click to play again'])
    expect(cardOf({ ...over, region: false }, PANE)).toEqual(['game over', `score ${over.game!.score}`, 'p to play again'])
  })

  test('a game that beats the best it started against ends on a gold card that says so, and by how much', () => {
    const ended = toppedOut(midGame())
    const score = ended.game!.score
    const over = { ...ended, bestBefore: score - 44 }
    expect(cardOf(over, AWAY)).toEqual([Play.NEW_BEST[Math.floor(over.now / Play.TWINKLE_MS) % 2], `score ${score}`, `up 44 on ${score - 44}`, 'click to play again'])
    const card = Play.screenOf(over, AWAY, 80).flat().filter(segment => segment.backgroundColor !== undefined)
    expect(card.every(segment => segment.backgroundColor === Play.COLORS.bestCard && segment.color === Play.COLORS.bestText)).toBe(true)
  })

  test('the first best on record says score only; a tie with the best is no new best', () => {
    const over = toppedOut(midGame())
    expect(cardOf(over, AWAY).slice(1)).toEqual([`score ${over.game!.score}`, 'click to play again'])
    expect(cardOf({ ...over, bestBefore: over.game!.score }, AWAY)[0]).toBe('game over')
  })

  test('the new best card twinkles on the frame clock, every 250 ms', () => {
    const over = { ...toppedOut(midGame()), bestBefore: 1 }
    const title = (play: PlayState) => cardOf(play, AWAY)[0]
    const later = frames(over, Play.TWINKLE_MS / 50)
    expect(Play.NEW_BEST).toEqual(['✦ new best ✦', '✧ new best ✧'])
    expect(new Set([title(over), title(later)])).toEqual(new Set(Play.NEW_BEST))
  })

  test('while the score in play beats the best it started against, the best label says new!', () => {
    const mid = midGame()
    const label = (play: PlayState) => texts(play, AWAY, 80)[15]!.trim().slice(0, 10).trim()
    expect(label({ ...mid, bestBefore: 1_000 })).toBe('best')
    expect(label({ ...mid, bestBefore: 10 })).toBe('best  new!')
    expect(label({ ...mid, bestBefore: mid.game!.score })).toBe('best')
  })

  test('paused, the whole board stays in view, dimmed, and the status line says how to resume', () => {
    const mid = midGame()
    const paused = Play.keyed(mid, { key: 'p' }, AWAY)
    expect(statusOf(paused, AWAY)).toBe('paused · p resumes')
    const rows = (play: PlayState) => Play.screenOf(play, AWAY, 80).slice(1, 1 + Game.VISIBLE_ROWS)
    const wellText = (play: PlayState) => rows(play).map(line => Play.textOf(line).slice(30, 50))
    expect(wellText(paused)).toEqual(wellText(mid))
    // the well's inner columns at 80 wide: a margin of 17, the hold panel and gap of 12, the frame
    const inWell = (line: Line) => {
      let at = 0
      return line.filter(segment => {
        const start = at
        at += segment.text.length
        return start >= 30 && start < 50
      })
    }
    const cells = rows(paused).flatMap(line => inWell(line).filter(segment => segment.text.includes(Play.CELL) || segment.text.includes(Play.GHOST)))
    expect(cells.length).toBeGreaterThan(0)
    expect(cells.every(segment => segment.dimColor === true)).toBe(true)
    expect(rows(mid).flatMap(inWell).some(segment => segment.dimColor === true), 'not dimmed in play').toBe(false)
  })

  test('best shows the higher of the stored best and the score in play', () => {
    const mid = midGame()
    const bestOf = (best: number) => texts(mid, { ...AWAY, best }, 80)[16]!.trim().split(/\s+/)[0]
    expect(bestOf(0)).toBe(String(mid.game!.score))
    expect(bestOf(5000)).toBe('5000')
  })
})

describe('the drawn tree', () => {
  type Node = { type: string; props: Record<string, unknown> }
  const fake = {
    Box: (props: Record<string, unknown>) => ({ type: 'Box', props }),
    Text: (props: Record<string, unknown>) => ({ type: 'Text', props }),
  } as unknown as Parameters<typeof Play.screenTree>[0]
  const strings = (node: unknown): string[] => {
    if (typeof node === 'string') {
      return [node]
    }
    const { children } = (node as Node).props
    return Array.isArray(children) ? children.flatMap(strings) : strings(children)
  }

  test('every text drawn in every state is free of control characters', () => {
    for (const { label, play, outside } of everyState()) {
      for (const text of strings(Play.screenTree(fake, Play.screenOf(play, outside, 80)))) {
        expect(/[\u0000-\u001f\u007f-\u009f]/.test(text), `${label}: ${JSON.stringify(text)}`).toBe(false)
      }
    }
  })

  test('a control character given to draw is dropped, the rest kept', () => {
    const lines: Line[] = [[{ text: 'a\u0007b\u001b[31mc\u009b' }]]
    expect(strings(Play.screenTree(fake, lines))).toEqual(['ab[31mc'])
  })
})

describe('the look', () => {
  const segmentsOf = (play: PlayState) => Play.screenOf(play, AWAY, 80).flat()

  test('the falling piece is tiles in its color; its ghost is shaded in its ghost color, never dim (dim draws grey)', () => {
    const mid = midGame()
    const kind = mid.game!.active!.kind
    const ghosts = segmentsOf(mid).filter(segment => segment.text.includes(Play.GHOST))
    expect(ghosts.length).toBeGreaterThan(0)
    expect(ghosts.every(segment => segment.color === Play.GHOST_COLORS[kind] && segment.dimColor === undefined)).toBe(true)
    expect(Play.GHOST).not.toBe(Play.CELL)
    const tiles = segmentsOf(mid).filter(segment => segment.text.includes(Play.CELL) && segment.color === Play.PIECE_COLORS[kind])
    expect(tiles.every(segment => segment.dimColor === undefined)).toBe(true)
  })

  test('a ghost color is its piece color 55% of the way from the dark well: #EE5588 over #1E1E2E is #903C60', () => {
    // by hand: 30 + (238 - 30) * 0.55 = 144.4, 30 + (85 - 30) * 0.55 = 60.25, 46 + (136 - 46) * 0.55 = 95.5
    expect(Play.PIECE_COLORS.I).toBe('#EE5588')
    expect(Play.GHOST_COLORS.I).toBe('#903C60')
    for (const kind of ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] as const) {
      const brightness = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b
      expect(brightness(rgbOf(String(Play.GHOST_COLORS[kind]))), kind).toBeLessThan(brightness(rgbOf(String(Play.PIECE_COLORS[kind]))) * 0.75)
    }
  })

  test('a held piece keeps its color after a hold; the box says used and its frame goes quiet until the next piece', () => {
    const mid = midGame()
    const held = mid.game!.hold!
    const panel = (play: PlayState) => Play.screenOf(play, AWAY, 80).slice(0, 5).map(line => line.slice(0, 3))
    const tiles = panel(mid).flat().filter(segment => segment.text.includes(Play.CELL))
    expect(tiles.length).toBeGreaterThan(0)
    expect(tiles.every(segment => segment.color === Play.PIECE_COLORS[held] && segment.dimColor === undefined)).toBe(true)
    expect(Play.textOf(Play.screenOf(mid, AWAY, 80)[0]!).trim().startsWith('hold  used')).toBe(true)
    const frame = (play: PlayState) => panel(play)[1]!.find(segment => segment.text.startsWith('╭'))?.color
    expect(frame(mid)).toBe(Play.COLORS.label)

    const locked = Play.keyed(mid, { key: 'x' }, AWAY)
    expect(locked.game!.canHold).toBe(true)
    expect(Play.textOf(Play.screenOf(locked, AWAY, 80)[0]!).trim().startsWith('hold  ')).toBe(true)
    expect(Play.textOf(Play.screenOf(locked, AWAY, 80)[0]!)).not.toContain('used')
    expect(frame(locked)).toBe(Play.COLORS.frame)
  })

  test('every piece and every ghost keeps its own color on a 256-color terminal', () => {
    const codes = (colors: Readonly<Record<string, unknown>>) => Object.values(colors).map(color => ansi256(rgbOf(String(color))))
    expect(new Set(codes(Play.PIECE_COLORS)).size).toBe(7)
    expect(new Set(codes(Play.GHOST_COLORS)).size).toBe(7)
  })

  test('the seven piece colors stay apart for normal vision and the three color vision deficiencies', () => {
    // CIEDE2000 of 2 is the smallest difference noticed side by side; 12 is told apart at a glance
    const colors = Object.fromEntries(Object.entries(Play.PIECE_COLORS).map(([kind, color]) => [kind, String(color)]))
    for (const vision of ['normal', 'protan', 'deutan', 'tritan'] as const) {
      const { distance, pair } = closestPair(colors, vision)
      expect(distance, `${vision}: ${pair}`).toBeGreaterThanOrEqual(12)
    }
  })

  test('the colors are the game\'s own: no piece wears the hue the common convention gives it', () => {
    // the convention: I cyan, O yellow, T purple, S green, Z red, J blue, L orange, as hue angles
    const convention = { I: 180, O: 60, T: 285, S: 120, Z: 0, J: 225, L: 30 } as const
    for (const [kind, angle] of Object.entries(convention)) {
      const away = Math.abs(((hueOf(rgbOf(String(Play.PIECE_COLORS[kind as keyof typeof convention]))) - angle + 540) % 360) - 180)
      expect(away, kind).toBeGreaterThan(30)
    }
  })
})
