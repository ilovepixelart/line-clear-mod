import { describe, expect, test, tier } from 'claude-code/testing'

import Game from '../../hooks/game'
import type { GameState, Kind } from '../../hooks/game'
import { boardFrom, bottomRows, keysOf } from '../fixtures/board'
import { deepFrozen, gameWith, play, times } from '../fixtures/game'

tier('user')

const ALL_KINDS: Kind[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z']
const where = (state: GameState) => state.active && { rotation: state.active.rotation, x: state.active.x, y: state.active.y }
/** The visible board drawn as strings, `#` for any cell, the falling piece included. */
const drawn = (state: GameState) => Game.boardOf(state).map(row => row.map(cell => (cell === null ? '.' : '#')).join(''))
const lastRows = (state: GameState, count: number) => drawn(state).slice(-count)

describe('a new game', () => {
  test('starts at level 1 with no score, no lines, nothing held and an empty visible board', () => {
    const game = Game.newGame(7)
    expect(Game.scoreOf(game)).toBe(0)
    expect(Game.linesOf(game)).toBe(0)
    expect(Game.levelOf(game)).toBe(1)
    expect(Game.phaseOf(game)).toBe('playing')
    expect(Game.holdOf(game)).toEqual({ kind: null, canHold: true })
    expect(Game.boardOf(game)).toHaveLength(18)
    expect(game.board.flat().every(cell => cell === null), 'nothing locked').toBe(true)
    expect(drawn(game).slice(1).every(row => row === '..........'), 'only the entering piece shows, in the top row').toBe(true)
  })

  test('shows the next five pieces, and the first seven dealt are one of each kind', () => {
    const game = Game.newGame(7)
    expect(Game.nextOf(game)).toHaveLength(5)
    expect(Game.nextOf(game)).toEqual(game.queue.slice(0, 5))
    expect([game.active!.kind, ...game.queue.slice(0, 6)].sort()).toEqual(ALL_KINDS)
  })

  test('the same seed starts the same game; another seed deals another order', () => {
    expect(Game.newGame(99)).toEqual(Game.newGame(99))
    const firstSeven = (seed: number) => {
      const game = Game.newGame(seed)
      return [game.active!.kind, ...game.queue.slice(0, 6)]
    }
    expect(firstSeven(1)).not.toEqual(firstSeven(2))
  })

  test('can start at a later level', () => {
    expect(Game.levelOf(Game.newGame(7, { startLevel: 5 }))).toBe(5)
  })

  test('refuses a start level that is not a whole number from 1', () => {
    expect(() => Game.newGame(7, { startLevel: 0 })).toThrow('startLevel')
    expect(() => Game.newGame(7, { startLevel: 2.5 })).toThrow('startLevel')
  })
})

describe('entering', () => {
  test('a piece enters one row below its spawn rows, so a cell of it shows at once', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const game = Game.newGame(seed)
      const spawn = Game.spawnPiece(game.active!.kind)
      expect(game.active!.y, `seed ${seed}`).toBe(spawn.y + 1)
      expect(Game.activeOf(game).length, `seed ${seed}: ${game.active!.kind}`).toBeGreaterThan(0)
    }
  })

  test('the next piece after a lock enters the same way', () => {
    const next = play(gameWith('O'), ['hardDrop'])
    expect(next.active!.y).toBe(Game.spawnPiece(next.active!.kind).y + 1)
  })

  test('a piece with no room for that row stays in its spawn rows, and the game goes on', () => {
    // visible row 0 taken under the T's spawn: it fits where it spawns but cannot come down
    const blocked = Game.emptyBoard().map((row, y) => row.map((cell, x) => (y === Game.HIDDEN_ROWS && x >= 3 && x <= 5 ? 'Z' : cell)))
    const entered = play(gameWith('O', blocked, { hold: 'T' }), ['hold'])
    expect(entered.active).toEqual(Game.spawnPiece('T'))
    expect(Game.phaseOf(entered)).toBe('playing')
  })
})

describe('moving and turning', () => {
  test('a slide moves the piece as far as it goes in one move: to the wall, or against the stack', () => {
    const game = gameWith('O')
    expect(where(play(game, ['slideLeft']))).toEqual({ rotation: 0, x: -1, y: 2 })
    expect(where(play(game, ['slideRight']))).toEqual({ rotation: 0, x: 7, y: 2 })
    // a column at 1 in the O's rows stops it at columns 2 and 3
    const post = Game.emptyBoard().map((row, y) => row.map((cell, x) => (x === 1 && (y === 2 || y === 3) ? 'Z' : cell)))
    expect(where(play(gameWith('O', post), ['slideLeft']))).toEqual({ rotation: 0, x: 1, y: 2 })
  })

  test('a slide on the stack spends one lock reset, however far it goes', () => {
    const resting = play(gameWith('O'), times(18, 'softDrop'))
    const slid = Game.step(resting, 'slideLeft', 10)
    expect(where(slid)).toEqual({ rotation: 0, x: -1, y: 20 })
    expect(slid.lockResets).toBe(resting.lockResets + 1)
  })

  test('a slide against the wall already does nothing', () => {
    const atWall = play(gameWith('O'), ['slideLeft'])
    expect(Game.step(atWall, 'slideLeft', 0)).toBe(atWall)
  })

  test('left and right move one column; the wall stops the piece where it is', () => {
    const game = gameWith('O')
    expect(where(play(game, ['left']))).toEqual({ rotation: 0, x: 2, y: 2 })
    expect(where(play(game, ['right']))).toEqual({ rotation: 0, x: 4, y: 2 })
    // O fills columns 4 and 5: four lefts reach column 0, the fifth is stopped
    expect(where(play(game, times(5, 'left')))).toEqual({ rotation: 0, x: -1, y: 2 })
    expect(where(play(game, times(9, 'right')))).toEqual({ rotation: 0, x: 7, y: 2 })
  })

  test('turns go clockwise and counterclockwise', () => {
    const game = gameWith('T')
    expect(where(play(game, ['rotateCw']))?.rotation).toBe(1)
    expect(where(play(game, ['rotateCcw']))?.rotation).toBe(3)
    expect(where(play(game, times(4, 'rotateCw')))?.rotation).toBe(0)
  })

  test('a turn at the left wall kicks the piece off it', () => {
    // T turned to point right, pushed to the wall (stem in column 0), turned again
    const game = play(gameWith('T'), ['rotateCw', ...times(5, 'left'), 'rotateCw'])
    expect(where(game)).toEqual({ rotation: 2, x: 0, y: 2 })
  })
})

describe('gravity', () => {
  test('at level 1 the piece falls one row each 1000 ms, catching up on a late tick', () => {
    const game = gameWith('O')
    expect(where(Game.step(game, 'tick', 999))?.y).toBe(2)
    expect(where(Game.step(game, 'tick', 1000))?.y).toBe(3)
    expect(where(Game.step(game, 'tick', 3500))?.y).toBe(5)
  })

  test('at level 5 it falls a row each 355 ms', () => {
    const game = gameWith('O', undefined, { startLevel: 5, level: 5 })
    expect(where(Game.step(game, 'tick', 709))?.y).toBe(3)
    expect(where(Game.step(game, 'tick', 710))?.y).toBe(4)
  })

  test('a piece that slides off a ledge starts gravity from the slide, not from its last fall', () => {
    // the O rests on a ledge in columns 0 to 3 from time 0, and at 400 ms slides off it
    const resting = play(gameWith('O', boardFrom('####......')), ['left', ...times(17, 'softDrop')])
    const slid = play(resting, ['right', 'right'], 400)
    expect(where(slid)).toEqual({ rotation: 0, x: 4, y: 19 })
    expect(where(Game.step(slid, 'tick', 1399))?.y).toBe(19)
    expect(where(Game.step(slid, 'tick', 1400))?.y).toBe(20)
  })

  test('time passes before the input: a move at 1000 ms happens after the row falls', () => {
    expect(where(Game.step(gameWith('O'), 'left', 1000))).toEqual({ rotation: 0, x: 2, y: 3 })
  })
})

describe('drops', () => {
  test('a soft drop moves down one row for 1 point and restarts the gravity clock', () => {
    const dropped = Game.step(gameWith('O'), 'softDrop', 900)
    expect(where(dropped)?.y).toBe(3)
    expect(Game.scoreOf(dropped)).toBe(1)
    expect(where(Game.step(dropped, 'tick', 1899))?.y).toBe(3)
    expect(where(Game.step(dropped, 'tick', 1900))?.y).toBe(4)
  })

  test('a hard drop locks at once at the ghost, for 2 points a row, and brings on the next piece', () => {
    const game = gameWith('T')
    const next = game.queue.slice(0, 6)
    const dropped = play(game, ['hardDrop'])
    // T spawns in rows 2 and 3 and falls 18 rows to rows 20 and 21 (visible 16 and 17)
    expect(lastRows(dropped, 2)).toEqual(['....#.....', '...###....'])
    expect(Game.scoreOf(dropped)).toBe(36)
    expect(dropped.active?.kind).toBe(next[0])
    expect(Game.nextOf(dropped)).toEqual(next.slice(1, 6))
  })

  test('the ghost shows where a hard drop would land, in visible rows', () => {
    expect(keysOf(Game.ghostOf(gameWith('T')))).toEqual(keysOf([{ x: 4, y: 16 }, { x: 3, y: 17 }, { x: 4, y: 17 }, { x: 5, y: 17 }]))
    const onStack = gameWith('O', boardFrom('....#.....'))
    expect(keysOf(Game.ghostOf(onStack))).toEqual(keysOf([{ x: 4, y: 15 }, { x: 5, y: 15 }, { x: 4, y: 16 }, { x: 5, y: 16 }]))
  })

  test('the falling piece is drawn on the visible board once it is in view', () => {
    const inView = play(gameWith('O'), times(2, 'softDrop'))
    expect(drawn(inView).slice(0, 2)).toEqual(['....##....', '....##....'])
  })
})

describe('lock delay', () => {
  // An O soft-dropped to the floor at time 0: rows 20 and 21, resting.
  const resting = () => play(gameWith('O'), times(18, 'softDrop'))
  /** The bottom row of locked cells: the falling piece is not in it. */
  const lockedFloor = (state: GameState) => bottomRows(state.board, 1)[0]

  test('a resting piece locks 500 ms after it lands, not before', () => {
    expect(where(resting())?.y).toBe(20)
    expect(lockedFloor(Game.step(resting(), 'tick', 499))).toBe('..........')
    expect(lockedFloor(Game.step(resting(), 'tick', 500))).toBe('....##....')
  })

  test('a soft drop on the floor does nothing: no points, no lock', () => {
    const pressed = Game.step(resting(), 'softDrop', 100)
    expect(Game.scoreOf(pressed)).toBe(18)
    expect(lockedFloor(pressed)).toBe('..........')
  })

  test('a move while resting restarts the delay', () => {
    const moved = Game.step(resting(), 'left', 300)
    expect(where(Game.step(moved, 'tick', 799))).toEqual({ rotation: 0, x: 2, y: 20 })
    expect(lockedFloor(Game.step(moved, 'tick', 800))).toBe('...##.....')
  })

  test('15 moves while resting each restart it; the 16th locks the piece at once', () => {
    let game = resting()
    for (let i = 1; i <= 15; i++) {
      game = Game.step(game, i % 2 === 1 ? 'left' : 'right', i * 10)
    }
    // the 15th move (a left, at 150 ms) leaves the O in columns 3 and 4
    expect(where(Game.step(game, 'tick', 649))).toEqual({ rotation: 0, x: 2, y: 20 })
    expect(lockedFloor(Game.step(game, 'tick', 650))).toBe('...##.....')
    expect(lockedFloor(Game.step(game, 'right', 160)), 'locked where the 16th move put it').toBe('....##....')
  })

  test('moves while falling spend no resets: a piece that lands after 18 of them still gets its delay', () => {
    // a tower in columns 0 and 1 up to the top visible row; the O slides onto it without falling a row
    const tower = boardFrom(...times(18, 'tick').map(() => '##........'))
    let game = play(gameWith('O', tower), times(16, 'tick').flatMap((_, i) => (i % 2 === 0 ? ['right'] : ['left'])))
    game = play(game, ['left', 'left', 'left'])
    expect(where(game), 'resting on the tower, not locked').toEqual({ rotation: 0, x: 0, y: 2 })
    expect(game.lockAt).toBe(0)
  })

  test('the lowest row is the cells\' own: a turn that lowers a cell without lowering the box gives the moves back', () => {
    // a T resting flat on the floor row, which has a hole under its middle; a turn
    // drops its middle cell into the hole while its box stays put
    const floor = boardFrom('####.#####')
    let game = play(gameWith('T', floor), times(20, 'softDrop'))
    expect(where(game)).toEqual({ rotation: 0, x: 3, y: 19 })
    for (let i = 1; i <= 14; i++) {
      game = Game.step(game, i % 2 === 1 ? 'left' : 'right', i)
    }
    game = Game.step(game, 'rotateCw', 15)
    expect(where(game)).toEqual({ rotation: 1, x: 3, y: 19 })
    // 16 presses in all: without the moves back, this one would lock the T
    game = Game.step(game, 'rotateCcw', 16)
    expect(game.active?.kind, 'still falling').toBe('T')
    expect(bottomRows(game.board, 1)[0]).toBe('####.#####')
  })

  test('reaching a new lowest row gives the piece its 15 moves back', () => {
    // a ledge in columns 0 to 3: the O rests on it in columns 3 and 4, one row up
    let game = play(gameWith('O', boardFrom('####......')), ['left', ...times(17, 'softDrop')])
    expect(where(game)).toEqual({ rotation: 0, x: 2, y: 19 })
    for (let i = 1; i <= 14; i++) {
      game = Game.step(game, i % 2 === 1 ? 'left' : 'right', i)
    }
    // the 15th counted move takes it off the ledge at 20 ms, one more clears it, and gravity lands it 1000 ms later
    game = play(game, ['right', 'right'], 20)
    game = Game.step(game, 'tick', 1020)
    expect(where(game)).toEqual({ rotation: 0, x: 4, y: 20 })
    for (let i = 1; i <= 15; i++) {
      game = Game.step(game, i % 2 === 1 ? 'left' : 'right', 1020 + i)
    }
    expect(where(game), 'still falling after 15 more moves').toEqual({ rotation: 0, x: 3, y: 20 })
    expect(lockedFloor(game)).toBe('####......')
  })
})

describe('line clears and scoring', () => {
  /** An I stood up and hard-dropped into the empty column 9 over `rows` rows of nine cells, under a row with one cell. */
  const fillWell = (rows: number, startLevel: number) => {
    const board = boardFrom('#.........', ...times(rows, 'tick').map(() => '#########.'))
    // the I stands up in column 5, four rights take it to column 9, and it falls 16 rows
    return play(gameWith('I', board, { startLevel, level: startLevel }), ['rotateCw', ...times(4, 'right'), 'hardDrop'])
  }

  test('at level 1 one to four rows clear for 100, 300, 500 and 800, plus 32 for the drop', () => {
    expect([1, 2, 3, 4].map(rows => Game.scoreOf(fillWell(rows, 1)))).toEqual([132, 332, 532, 832])
    expect([1, 2, 3, 4].map(rows => Game.linesOf(fillWell(rows, 1)))).toEqual([1, 2, 3, 4])
  })

  test('at level 5 the clears score five times as much', () => {
    expect([1, 2, 3, 4].map(rows => Game.scoreOf(fillWell(rows, 5)))).toEqual([532, 1532, 2532, 4032])
  })

  test('the game records which board rows the last lock cleared, and none once a lock clears nothing', () => {
    expect(fillWell(2, 1).lastClear).toEqual([20, 21])
    expect(fillWell(4, 1).lastClear).toEqual([18, 19, 20, 21])
    expect(Game.newGame(7).lastClear).toEqual([])
    const after = play(Game.step(fillWell(2, 1), 'tick', Game.CLEAR_MS), ['hardDrop'], Game.CLEAR_MS)
    expect(Game.linesOf(after)).toBe(2)
    expect(after.lastClear).toEqual([])
  })

  test('cleared rows leave the rest of the I above them', () => {
    // the row with one cell above the cleared rows falls with the rest
    expect(lastRows(fillWell(1, 1), 4)).toEqual(['..........', '.........#', '.........#', '#........#'])
    expect(lastRows(fillWell(4, 1), 1)).toEqual(['#.........'])
  })

  test('the tenth line raises the level; that clear still scores at the old level', () => {
    const game = gameWith('O', boardFrom('####..####'), { lines: 9 })
    const cleared = play(game, ['hardDrop'])
    expect(Game.linesOf(cleared)).toBe(10)
    expect(Game.levelOf(cleared)).toBe(2)
    // a single at level 1 (100) and an 18-row hard drop (36)
    expect(Game.scoreOf(cleared)).toBe(136)
  })
})

describe('the clearing pause', () => {
  /** An I stood up over two rows of nine cells and hard dropped at time 0: it clears both rows. */
  const clearing = () => play(gameWith('I', boardFrom('#########.', '#########.')), ['rotateCw', ...times(4, 'right'), 'hardDrop'])

  test('a lock that clears rows scores at once and holds the next piece back for 200 ms', () => {
    const game = clearing()
    expect(Game.linesOf(game)).toBe(2)
    expect(game.active).toBeNull()
    expect(Game.clearingOf(game)).toEqual({ rows: [20, 21], startedAt: 0, until: Game.CLEAR_MS })
    expect(Game.CLEAR_MS).toBe(200)
    expect(Game.step(game, 'tick', 199).active).toBeNull()
    const entered = Game.step(game, 'tick', 200)
    expect(entered.active?.kind).toBe(game.queue[0])
    expect(Game.clearingOf(entered)).toBeNull()
  })

  test('a lock that clears nothing brings the next piece on at once', () => {
    const game = play(gameWith('O'), ['hardDrop'])
    expect(game.active).not.toBeNull()
    expect(Game.clearingOf(game)).toBeNull()
  })

  test('moves and drops made while rows clear are dropped; the piece enters where it spawns', () => {
    const game = clearing()
    const next = game.queue[0]!
    const entered = Game.step(play(game, ['left', 'left', 'softDrop', 'hardDrop'], 100), 'tick', 200)
    expect(entered.active).toEqual({ ...Game.spawnPiece(next), y: Game.spawnPiece(next).y + 1 })
    expect(Game.scoreOf(entered)).toBe(Game.scoreOf(game))
  })

  test('the last turn made while rows clear is kept and done as the piece enters', () => {
    const turned = (inputs: ('rotateCw' | 'rotateCcw')[]) => Game.step(play(clearing(), inputs, 100), 'tick', 200).active?.rotation
    expect(turned(['rotateCw'])).toBe(1)
    expect(turned(['rotateCw', 'rotateCcw'])).toBe(3)
    expect(turned(['rotateCcw', 'rotateCw'])).toBe(1)
  })

  test('a hold made while rows clear is kept and done as the piece enters', () => {
    const game = clearing()
    const [first, second] = game.queue
    const entered = Game.step(Game.step(game, 'hold', 100), 'tick', 200)
    expect(Game.holdOf(entered)).toEqual({ kind: first, canHold: false })
    expect(entered.active?.kind).toBe(second)
  })

  test('a pause while rows clear holds the clearing too', () => {
    const paused = Game.step(clearing(), 'pause', 100)
    const resumed = Game.step(paused, 'pause', 1100)
    expect(Game.step(resumed, 'tick', 1199).active).toBeNull()
    expect(Game.step(resumed, 'tick', 1200).active).not.toBeNull()
  })
})

describe('purity', () => {
  test('a step returns a new state and leaves the one it was given untouched', () => {
    const game = deepFrozen(gameWith('T', boardFrom('####..####')))
    const copy = structuredClone(game)
    for (const input of ['left', 'right', 'rotateCw', 'rotateCcw', 'softDrop', 'hardDrop', 'tick'] as const) {
      Game.step(game, input, 5000)
    }
    expect(game).toEqual(copy)
  })
})
