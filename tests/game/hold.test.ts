import { describe, expect, test, tier } from 'claude-code/testing'

import Game from '../../hooks/game'
import { gameWith, play, times } from '../fixtures/game'

tier('user')

/** Where a piece of `kind` is once it has entered: its spawn position, one row down. */
const entered = (kind: Parameters<typeof Game.spawnPiece>[0]) => ({ ...Game.spawnPiece(kind), y: Game.spawnPiece(kind).y + 1 })

describe('hold', () => {
  test('the first hold keeps the piece and brings on the next one from the queue', () => {
    const game = gameWith('T')
    const next = game.queue.slice(0, 4)
    const held = play(game, ['hold'])
    expect(Game.holdOf(held)).toEqual({ kind: 'T', canHold: false })
    expect(held.active).toEqual(entered(next[0]!))
    expect(Game.nextOf(held)).toEqual(next.slice(1, 4))
  })

  test('a second hold before the piece locks does nothing', () => {
    const held = play(gameWith('T'), ['hold'])
    expect(Game.step(held, 'hold', 0)).toEqual(held)
  })

  test('after a lock, hold swaps: the held piece comes back and the queue does not move', () => {
    const afterLock = play(gameWith('T'), ['hold', 'hardDrop'])
    expect(Game.holdOf(afterLock)).toEqual({ kind: 'T', canHold: true })
    const falling = afterLock.active!.kind
    const swapped = play(afterLock, ['hold'])
    expect(swapped.active).toEqual(entered('T'))
    expect(Game.holdOf(swapped)).toEqual({ kind: falling, canHold: false })
    expect(swapped.queue).toEqual(afterLock.queue)
  })

  test('a held piece comes back at its spawn position, unturned, wherever it was held from', () => {
    const moved = play(gameWith('T'), ['rotateCw', 'left', 'left', ...times(5, 'softDrop'), 'hold', 'hardDrop'])
    expect(play(moved, ['hold']).active).toEqual(entered('T'))
  })

  test('the piece a hold brings on starts its own gravity clock', () => {
    const held = Game.step(gameWith('T'), 'hold', 900)
    const spawnY = held.active!.y
    expect(Game.step(held, 'tick', 1899).active!.y).toBe(spawnY)
    expect(Game.step(held, 'tick', 1900).active!.y).toBe(spawnY + 1)
  })
})
