import type { ClientModule } from 'claude-code'

import Play from '../play'
import type { Outside, Play as PlayState, Press } from '../play'

/** What the hooks module hands the game region. */
export type WellProps = {
  /** The best score kept, to show beside this game's. */
  best: number
  /** A base for each game's seed, from the hooks module's clock. */
  seedBase: number
  /** Whether the pane holds the keys (its Buttons' hotkeys), as the pane says. */
  paneFocused: boolean
  /** The pane body's width, used until the region has been laid out. */
  columns: number
  /** The latest pane Button presses, numbered. */
  presses: Press[]
  /** The level each game starts at, from the startLevel setting. */
  startLevel: number
}

/** What the hooks module hears from the region: an ended game's score. */
export type WellPost = { kind: 'over'; score: number }

/** Each instance's latest props, for its handlers: they were set up on the first call, with that call's props. */
const latestProps = new WeakMap<object, WellProps>()

const lastSeq = (presses: readonly Press[]) => presses.reduce((seq, press) => Math.max(seq, press.seq), 0)

/**
 * The game region: the play state on the frame clock, clicks and keys from
 * the region, presses from the pane's Buttons through props. Each change
 * is one setState; an ended game's score is posted once.
 */
const Well: ClientModule<WellProps, PlayState> = (props, surface) => {
  latestProps.set(surface, props)
  const outside = (): Outside => {
    const latest = latestProps.get(surface) ?? props

    return { paneFocused: latest.paneFocused, seedBase: latest.seedBase, best: latest.best, startLevel: latest.startLevel }
  }
  const commit = (next: PlayState) => {
    const score = Play.scoreToReport(next)
    if (score !== null) {
      surface.post({ kind: 'over', score } satisfies WellPost)
    }
    surface.setState(score === null ? next : { ...next, reported: true })
  }

  if (surface.state === undefined) {
    surface.setState(Play.startPlay(lastSeq(props.presses)))
    surface.every(Play.TICK_MS, () => surface.state && commit(Play.ticked(surface.state, outside())))
    surface.onPointer(event => surface.state && commit(Play.pointed(surface.state, event, outside())))
    surface.onKey(event => surface.state && commit(Play.keyed(surface.state, event, outside())))
  }

  const current = surface.state ?? Play.startPlay(lastSeq(props.presses))
  // new props are the only way presses arrive: applied here, once each
  const play = Play.pressed(current, props.presses, outside())
  if (play !== current) {
    commit(play)
  }
  const columns = surface.columns > 0 ? surface.columns : props.columns

  return Play.screenTree(surface.elements, Play.screenOf(play, outside(), columns))
}

export default Well
