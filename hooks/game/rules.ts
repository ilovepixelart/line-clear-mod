/**
 * The game's numbers. Scoring and gravity follow the widely published modern
 * guideline values.
 */

/** A T spin by the three-corner rule: none, a mini, or a full spin. */
export type Spin = 'none' | 'mini' | 'spin'

/** Points for clearing 0 to 4 rows with one lock, by spin, before multiplying by the level. */
const CLEAR_POINTS: Readonly<Record<Spin, readonly number[]>> = {
  none: [0, 100, 300, 500, 800],
  mini: [100, 200, 400],
  spin: [400, 800, 1200, 1600],
}

/** A difficult clear right after another one scores this many times its points. */
export const BACK_TO_BACK = 1.5

/** Whether a clear is difficult, for back to back: four rows at once, or a spin that clears rows. */
export const isDifficult = (rows: number, spin: Spin) => rows === 4 || (rows > 0 && spin !== 'none')

/** Each clear right after another adds this many points times the run's count (the second in a row is 1) times the level. */
export const COMBO_POINTS = 50

/**
 * The all clear bonus for one to four rows, before the level, added to the
 * clear's own points; a back to back four that empties the well gets
 * ALL_CLEAR_BACK_TO_BACK_FOUR instead.
 */
const ALL_CLEAR_POINTS = [0, 800, 1200, 1800, 2000] as const
const ALL_CLEAR_BACK_TO_BACK_FOUR = 3200

/** The all clear bonus for a clear of `rows` rows that empties the well, at `level`. */
export function allClearScore(rows: number, level: number, isBackToBack: boolean): number {
  const points = rows === 4 && isBackToBack ? ALL_CLEAR_BACK_TO_BACK_FOUR : (ALL_CLEAR_POINTS[rows as 0 | 1 | 2 | 3 | 4] ?? 0)

  return points * level
}

/** Points per row a soft drop moves the piece down. */
export const SOFT_DROP_POINTS = 1

/** Points per row a hard drop moves the piece down. */
export const HARD_DROP_POINTS = 2

/** Rows to clear for each level up. */
export const LINES_PER_LEVEL = 10

/** How long cleared rows stay before the next piece enters: a lock that clears nothing brings it on at once. */
export const CLEAR_MS = 200

/** How long a piece may rest on the stack before it locks. */
export const LOCK_DELAY_MS = 500

/** How many moves or turns on the stack restart the lock delay; past that the piece locks as soon as it rests. */
export const LOCK_RESET_CAP = 15

/** Gravity stops speeding up here, at about 7 ms a row. */
const FASTEST_GRAVITY_LEVEL = 15

/** The score for clearing `lines` rows with one lock at `level`, a spin or not. */
export function clearScore(lines: number, level: number, spin: Spin = 'none'): number {
  return (CLEAR_POINTS[spin][lines] ?? 0) * level
}

/** The level after `lines` cleared rows in a game started at `startLevel`. */
export function levelFor(startLevel: number, lines: number): number {
  return startLevel + Math.floor(lines / LINES_PER_LEVEL)
}

/** Milliseconds per row of gravity: (0.8 - (level - 1) * 0.007) ^ (level - 1) seconds, capped at level 15. */
export function gravityMs(level: number): number {
  const steps = Math.min(level, FASTEST_GRAVITY_LEVEL) - 1

  return Math.round(1000 * (0.8 - steps * 0.007) ** steps)
}
