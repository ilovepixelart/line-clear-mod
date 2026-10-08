import { describe, expect, test, tier } from 'claude-code/testing'

import Game from '../../hooks/game'
import Play from '../../hooks/play'
import type { Outside, Play as PlayState } from '../../hooks/play'

tier('user')

const AWAY: Outside = { paneFocused: false, seedBase: 1_000 }
const PANE: Outside = { paneFocused: true, seedBase: 1_000 }
const CLICK = { type: 'down', x: 3, y: 3, button: 'left' } as const

/** Frames of the frame clock, `ms` of them in all. */
function frames(play: PlayState, ms: number, outside: Outside = AWAY): PlayState {
  let current = play
  for (let elapsed = 0; elapsed < ms; elapsed += Play.TICK_MS) {
    current = Play.ticked(current, outside)
  }

  return current
}

const clicked = (outside: Outside = AWAY) => Play.pointed(Play.startPlay(0), CLICK, outside)
const columnOf = (play: PlayState) => play.game?.active?.x
const rowOf = (play: PlayState) => play.game?.active?.y

/** Hard drops in the middle until the stack reaches the top. */
function toppedOut(play: PlayState): PlayState {
  let current = play
  for (let drops = 0; drops < 200 && current.game?.phase !== 'over'; drops++) {
    current = Play.keyed(current, { key: 'space' }, AWAY)
  }

  return current
}

describe('before the first click', () => {
  test('there is no game and nobody has the keys', () => {
    const play = Play.startPlay(0)
    expect(play.game).toBeNull()
    expect(Play.focusOf(play, AWAY)).toBe('none')
  })

  test('frames go by and keys do nothing without a game', () => {
    const play = Play.keyed(frames(Play.startPlay(0), 3_000), { key: 'left' }, AWAY)
    expect(play.game).toBeNull()
    expect(play.now).toBe(3_000)
  })
})

describe('a click on the game region', () => {
  test('starts a game and gives the region the keys', () => {
    const play = clicked()
    expect(play.game?.phase).toBe('playing')
    expect(Play.focusOf(play, AWAY)).toBe('region')
  })

  test('seeds the game from the clock: the same clock deals the same game, another clock another', () => {
    const at = (outside: Outside, ms: number) => Play.pointed(frames(Play.startPlay(0), ms), CLICK, outside).game
    expect(at(AWAY, 500)).toEqual(at(AWAY, 500))
    const firstFourteen = (ms: number, seedBase: number) => {
      const game = at({ paneFocused: false, seedBase }, ms)!
      return [game.active!.kind, ...game.queue.slice(0, 13)].join('')
    }
    expect(firstFourteen(500, 1_000)).not.toEqual(firstFourteen(550, 1_000))
    expect(firstFourteen(500, 1_000)).not.toEqual(firstFourteen(500, 77_777))
  })

  test('a pointer that only moves or comes up changes nothing', () => {
    const play = Play.startPlay(0)
    expect(Play.pointed(play, { ...CLICK, type: 'move' }, AWAY)).toBe(play)
    expect(Play.pointed(play, { ...CLICK, type: 'up' }, AWAY)).toBe(play)
  })

  test('on a running game it does not start another', () => {
    const play = Play.keyed(clicked(), { key: 'left' }, AWAY)
    expect(Play.pointed(play, CLICK, AWAY).game).toBe(play.game)
  })
})

describe('keys on the clicked region', () => {
  test('left and right move the falling piece one column', () => {
    const play = clicked()
    expect(columnOf(Play.keyed(play, { key: 'left' }, AWAY))).toBe(columnOf(play)! - 1)
    expect(columnOf(Play.keyed(play, { key: 'right' }, AWAY))).toBe(columnOf(play)! + 1)
  })

  test('a burst moves once per key', () => {
    const play = clicked()
    expect(columnOf(Play.keyed(play, { key: 'aaa' }, AWAY))).toBe(columnOf(play)! - 3)
  })

  test('space drops the piece and the next one enters', () => {
    const play = clicked()
    const dropped = Play.keyed(play, { key: 'space' }, AWAY)
    expect(dropped.game?.active?.kind).toBe(play.game?.queue[0])
    expect(Game.boardOf(dropped.game!).at(-1)!.some(cell => cell !== null)).toBe(true)
  })

  test('an unknown key changes nothing in the game', () => {
    const play = clicked()
    expect(Play.keyed(play, { key: 'k' }, AWAY).game).toBe(play.game)
  })
})

describe('gravity on the frame clock', () => {
  test('a piece falls one row a second at level 1: 20 frames of 50 ms', () => {
    const play = clicked()
    expect(rowOf(frames(play, 950))).toBe(rowOf(play))
    expect(rowOf(frames(play, 1_000))).toBe(rowOf(play)! + 1)
  })
})

describe('focus inferred from silence', () => {
  test('two seconds with no key and the region lets go: the game pauses', () => {
    const before = frames(clicked(), Play.IDLE_MS - Play.TICK_MS)
    expect(Play.focusOf(before, AWAY)).toBe('region')
    expect(before.game?.phase).toBe('playing')
    const after = Play.ticked(before, AWAY)
    expect(Play.focusOf(after, AWAY)).toBe('none')
    expect(after.game?.phase).toBe('paused')
  })

  test('a paused game does not fall', () => {
    const idle = frames(clicked(), Play.IDLE_MS)
    expect(rowOf(frames(idle, 10_000))).toBe(rowOf(idle))
  })

  test('each key restarts the wait', () => {
    let play = clicked()
    for (let at = 0; at < 6; at++) {
      play = Play.keyed(frames(play, 1_500), { key: 'k' }, AWAY)
    }
    expect(Play.focusOf(play, AWAY)).toBe('region')
    expect(play.game?.phase).toBe('playing')
  })

  test('the first key after the pause only resumes; the next one moves', () => {
    const idle = frames(clicked(), Play.IDLE_MS)
    const resumed = Play.keyed(idle, { key: 'left' }, AWAY)
    expect(resumed.game?.phase).toBe('playing')
    expect(Play.focusOf(resumed, AWAY)).toBe('region')
    expect(columnOf(resumed)).toBe(columnOf(idle))
    expect(columnOf(Play.keyed(resumed, { key: 'left' }, AWAY))).toBe(columnOf(idle)! - 1)
  })

  test('a click resumes the paused game without starting another', () => {
    const idle = frames(clicked(), Play.IDLE_MS)
    const back = Play.pointed(idle, CLICK, AWAY)
    expect(back.game?.phase).toBe('playing')
    expect(back.game?.active).toEqual(idle.game?.active)
  })

  test('a game the person paused stays paused when the keys come back', () => {
    const paused = Play.keyed(clicked(), { key: 'p' }, AWAY)
    const back = Play.keyed(frames(paused, Play.IDLE_MS), { key: 'k' }, AWAY)
    expect(back.game?.phase).toBe('paused')
    expect(Play.keyed(back, { key: 'p' }, AWAY).game?.phase).toBe('playing')
  })
})

describe('the focused pane and its Buttons', () => {
  test('the pane has the keys while it says it is focused, and never goes idle', () => {
    const play = Play.pressed(Play.startPlay(0), [{ seq: 1, key: 'p' }], PANE)
    expect(Play.focusOf(play, PANE)).toBe('pane')
    const later = frames(play, 10_000, PANE)
    expect(later.game?.phase).toBe('playing')
  })

  test('the game pauses on the frame after the pane lets go, and resumes when it has the keys again', () => {
    const play = Play.pressed(Play.startPlay(0), [{ seq: 1, key: 'p' }], PANE)
    const away = Play.ticked(play, AWAY)
    expect(away.game?.phase).toBe('paused')
    expect(Play.ticked(away, PANE).game?.phase).toBe('playing')
  })

  test('each press applies once, however often the same presses come again', () => {
    const play = Play.pressed(Play.startPlay(0), [{ seq: 1, key: 'p' }], PANE)
    const presses = [
      { seq: 1, key: 'p' },
      { seq: 2, key: 'a' },
      { seq: 3, key: 'a' },
    ] as const
    const once = Play.pressed(play, presses, PANE)
    expect(columnOf(once)).toBe(columnOf(play)! - 2)
    expect(Play.pressed(once, presses, PANE)).toBe(once)
    expect(columnOf(Play.pressed(once, [...presses, { seq: 4, key: 'd' }], PANE))).toBe(columnOf(play)! - 1)
  })

  test('presses made before the region started are not its to apply', () => {
    const play = Play.startPlay(5)
    expect(Play.pressed(play, [{ seq: 4, key: 'p' }, { seq: 5, key: 'p' }], PANE)).toBe(play)
    expect(Play.pressed(play, [{ seq: 6, key: 'p' }], PANE).game?.phase).toBe('playing')
  })

  test('a press whose key is no hotkey moves nothing', () => {
    const play = Play.pressed(Play.startPlay(0), [{ seq: 1, key: 'p' }], PANE)
    const after = Play.pressed(play, [{ seq: 2, key: 'z' }, { seq: 3, key: 'left' }], PANE)
    expect(after.game).toBe(play.game)
    expect(after.seq).toBe(3)
  })

  test('with no game running only pause starts one', () => {
    const play = Play.startPlay(0)
    expect(Play.pressed(play, [{ seq: 1, key: 'a' }], PANE).game).toBeNull()
    expect(Play.pressed(play, [{ seq: 1, key: 'x' }], PANE).game).toBeNull()
    expect(Play.pressed(play, [{ seq: 1, key: 'p' }], PANE).game?.phase).toBe('playing')
  })
})

describe('game over', () => {
  test('the ended game hands over its score once', () => {
    const over = toppedOut(clicked())
    expect(over.game?.phase).toBe('over')
    expect(Play.scoreToReport(over)).toBe(over.game!.score)
    expect(over.game!.score).toBeGreaterThan(0)
    expect(Play.scoreToReport({ ...over, reported: true })).toBeNull()
    expect(Play.scoreToReport(clicked())).toBeNull()
  })

  test('keys do not restart it; a click does', () => {
    const over = { ...toppedOut(clicked()), reported: true }
    expect(Play.keyed(over, { key: 'space' }, AWAY).game).toBe(over.game)
    const again = Play.pointed(over, CLICK, AWAY)
    expect(again.game?.phase).toBe('playing')
    expect(again.game?.score).toBe(0)
    expect(again.reported).toBe(false)
  })

  test('from the pane, pause plays again and other presses do nothing', () => {
    const over = { ...toppedOut(clicked()), reported: true }
    expect(Play.pressed(over, [{ seq: 1, key: 'x' }], PANE).game).toBe(over.game)
    expect(Play.pressed(over, [{ seq: 1, key: 'p' }], PANE).game?.score).toBe(0)
  })
})
