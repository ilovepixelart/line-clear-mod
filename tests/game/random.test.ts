import { describe, expect, test, tier } from 'claude-code/testing'

import Game from '../../hooks/game'
import type { Kind } from '../../hooks/game'

tier('user')

const ALL_KINDS: Kind[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z']

/** Draws n values from a seed, threading the generator state by hand. */
function drawsOf(seed: number, n: number): number[] {
  let state = Game.seedRandom(seed)
  const values: number[] = []
  for (let i = 0; i < n; i++) {
    const next = Game.nextRandom(state)
    values.push(next.value)
    state = next.state
  }

  return values
}

/** The first n pieces the bag randomiser deals from a seed. */
function dealtOf(seed: number, n: number): Kind[] {
  let state = Game.seedRandom(seed)
  const dealt: Kind[] = []
  while (dealt.length < n) {
    const bag = Game.shuffledBag(state)
    dealt.push(...bag.bag)
    state = bag.state
  }

  return dealt.slice(0, n)
}

describe('seeded random', () => {
  test('every value lies in [0, 1)', () => {
    for (const value of drawsOf(7, 5000)) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  test('the same seed gives the same sequence', () => {
    expect(drawsOf(42, 100)).toEqual(drawsOf(42, 100))
  })

  test('different seeds give different sequences', () => {
    expect(drawsOf(1, 20)).not.toEqual(drawsOf(2, 20))
  })

  test('the values spread over the interval: each tenth gets 7 to 13 percent of 10000 draws', () => {
    const tenths = Array.from({ length: 10 }, () => 0)
    for (const value of drawsOf(2026, 10000)) {
      tenths[Math.floor(value * 10)]! += 1
    }
    for (const count of tenths) {
      expect(count).toBeGreaterThan(700)
      expect(count).toBeLessThan(1300)
    }
  })

  test('a seed outside the 32-bit range still gives a usable, repeatable sequence', () => {
    expect(drawsOf(2 ** 40 + 3, 10)).toEqual(drawsOf(2 ** 40 + 3, 10))
    expect(drawsOf(-5, 10)).toEqual(drawsOf(-5, 10))
  })
})

describe('7-bag', () => {
  test('every aligned group of 7 dealt pieces is a permutation of the seven kinds', () => {
    for (const seed of [0, 1, 99, 123456]) {
      const dealt = dealtOf(seed, 700)
      for (let start = 0; start < dealt.length; start += 7) {
        expect([...dealt.slice(start, start + 7)].sort()).toEqual(ALL_KINDS)
      }
    }
  })

  test('the same seed deals the same pieces', () => {
    expect(dealtOf(5, 140)).toEqual(dealtOf(5, 140))
  })

  test('different seeds deal different orders', () => {
    expect(dealtOf(5, 70)).not.toEqual(dealtOf(6, 70))
  })

  test('over many bags each kind opens a bag sometimes: the shuffle is not fixed', () => {
    const openers = new Set(Array.from({ length: 200 }, (_, i) => dealtOf(i, 1)[0]))
    expect([...openers].sort()).toEqual(ALL_KINDS)
  })
})
