/**
 * A seeded pseudo-random generator, mulberry32: a 32-bit state, one multiply
 * and xor-shift round per value. Pure: the state goes in and the next state
 * comes out, so a game replays exactly from its seed.
 */

/** Folds any finite number into the generator's 32-bit unsigned state. */
export function seedRandom(seed: number): number {
  return Math.trunc(seed) >>> 0
}

/** The next value in [0, 1) and the state that follows it. */
export function nextRandom(state: number): { value: number; state: number } {
  const next = (state + 0x6d2b79f5) >>> 0
  let t = next
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296

  return { value, state: next }
}
