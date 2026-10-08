import { nextRandom } from './random'
import type { Kind } from './types'

/** Every kind once, in a fixed order the shuffle starts from. */
export const KINDS: readonly Kind[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']

/** One bag of all seven kinds in a seeded random order (Fisher-Yates), and the generator state after it. */
export function shuffledBag(state: number): { bag: Kind[]; state: number } {
  const bag = [...KINDS]
  let current = state
  for (let i = bag.length - 1; i > 0; i--) {
    const draw = nextRandom(current)
    current = draw.state
    const j = Math.floor(draw.value * (i + 1))
    ;[bag[i], bag[j]] = [bag[j]!, bag[i]!]
  }

  return { bag, state: current }
}
