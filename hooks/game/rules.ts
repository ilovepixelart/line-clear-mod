/**
 * The game's numbers. Scoring and gravity follow the widely published modern
 * guideline values; back-to-back bonuses, combos and spin bonuses are not
 * scored.
 */

/** Points for clearing 0 to 4 rows with one lock, before multiplying by the level. */
const CLEAR_POINTS = [0, 100, 300, 500, 800] as const

/** Points per row a soft drop moves the piece down. */
export const SOFT_DROP_POINTS = 1

/** Points per row a hard drop moves the piece down. */
export const HARD_DROP_POINTS = 2

/** Rows to clear for each level up. */
export const LINES_PER_LEVEL = 10

/** How long a piece may rest on the stack before it locks. */
export const LOCK_DELAY_MS = 500

/** How many moves or turns on the stack restart the lock delay; past that the piece locks as soon as it rests. */
export const LOCK_RESET_CAP = 15

/** Gravity stops speeding up here, at about 7 ms a row. */
const FASTEST_GRAVITY_LEVEL = 15

/** The score for clearing `lines` rows with one lock at `level`. */
export function clearScore(lines: number, level: number): number {
  return (CLEAR_POINTS[lines as 0 | 1 | 2 | 3 | 4] ?? 0) * level
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
