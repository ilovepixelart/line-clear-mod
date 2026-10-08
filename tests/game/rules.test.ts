import { describe, expect, test, tier } from 'claude-code/testing'

import Game from '../../hooks/game'

tier('user')

describe('scoring', () => {
  test('at level 1 a single, double, triple and four-line clear score 100, 300, 500 and 800', () => {
    expect([1, 2, 3, 4].map(lines => Game.clearScore(lines, 1))).toEqual([100, 300, 500, 800])
  })

  test('at level 5 the same clears score five times as much', () => {
    expect([1, 2, 3, 4].map(lines => Game.clearScore(lines, 5))).toEqual([500, 1500, 2500, 4000])
  })

  test('a lock that clears nothing scores nothing', () => {
    expect(Game.clearScore(0, 7)).toBe(0)
  })
})

describe('levels', () => {
  test('from level 1 the level goes up every 10 lines', () => {
    expect([0, 9, 10, 19, 20, 35].map(lines => Game.levelFor(1, lines))).toEqual([1, 1, 2, 2, 3, 4])
  })

  test('a later start level counts up from where it started', () => {
    expect([0, 9, 10].map(lines => Game.levelFor(5, lines))).toEqual([5, 5, 6])
  })
})

describe('gravity', () => {
  // (0.8 - (level - 1) * 0.007) ^ (level - 1) seconds per row, worked by hand and rounded to the millisecond
  test('level 1 falls a row a second, level 2 every 793 ms, level 5 every 355 ms, level 10 every 64 ms', () => {
    expect([1, 2, 5, 10].map(Game.gravityMs)).toEqual([1000, 793, 355, 64])
  })

  test('level 15 falls every 7 ms and no level is faster', () => {
    expect(Game.gravityMs(15)).toBe(7)
    expect(Game.gravityMs(16)).toBe(7)
    expect(Game.gravityMs(200)).toBe(7)
  })

  test('every level falls at least as fast as the one before it, and never in 0 ms', () => {
    for (let level = 2; level <= 40; level++) {
      expect(Game.gravityMs(level)).toBeLessThanOrEqual(Game.gravityMs(level - 1))
      expect(Game.gravityMs(level)).toBeGreaterThan(0)
    }
  })
})
