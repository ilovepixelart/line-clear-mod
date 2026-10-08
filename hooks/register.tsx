import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import Play from './play'
import type { WellPost, WellProps } from './clients/well'

const PANE = 'line-clear'
const TITLE = 'line-clear'

/** The store key of the best score: a number, and the only thing the mod keeps. */
const BEST = 'best'

/** How many recent presses the game region is handed; it applies each once by its number. */
const PRESSES_KEPT = 16

/** Body rows the game wants inline (the region and the two legend rows), and columns docked. */
const PANE_ROWS = Play.GAME_ROWS + 2
const PANE_COLUMNS = Play.GAME_COLUMNS + 4

const presses = atom({ plugin: 'line-clear', key: 'presses' } as const, [])

const open = ($: EngineInterface) => $.ui.open({ id: PANE, title: TITLE, rows: PANE_ROWS, columns: PANE_COLUMNS })

async function bestOf($: EngineInterface): Promise<number> {
  const stored = await $.store.get(BEST)

  return typeof stored === 'number' && Number.isFinite(stored) && stored > 0 ? Math.floor(stored) : 0
}

const isOver = (data: unknown): data is WellPost =>
  typeof data === 'object' && data !== null && (data as WellPost).kind === 'over' && Number.isSafeInteger((data as WellPost).score)

/** The two legend rows of hotkey Buttons: what the keyboard path plays with. */
const LEGEND = [Play.HOTKEYS.slice(0, 4), Play.HOTKEYS.slice(4)]

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'line-clear', description: 'Open the line-clear game pane: click the well to play' })

    return next(e)
  })

  on('command.run', { command: 'line-clear' }, async $ => {
    await open($)

    return {}
  })

  on('ui.message', { requestId: PANE }, async ($, e) => {
    if (isOver(e.data) && e.data.score > (await bestOf($))) {
      await $.store.set(BEST, e.data.score)
      $.ui.invalidate('ui.render')
    }

    return {}
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    // the other surfaces' tables carry no running Client today
    if (!(e.surface === 'terminal' || e.surface === 'desktop') || !('Client' in els)) {
      return <Text dimColor>line-clear plays in the terminal and the desktop app.</Text>
    }
    const props: WellProps = {
      best: await bestOf($),
      seedBase: await $.clock.now(),
      paneFocused: e.props.isFocused,
      columns: e.props.bodyColumns,
      presses: await read($, presses),
    }
    const margin = Math.max(0, Math.floor((e.props.bodyColumns - Play.GAME_COLUMNS) / 2))
    const press = (key: string) => () => update($, presses, list => [...list, { seq: (list.at(-1)?.seq ?? 0) + 1, key }].slice(-PRESSES_KEPT))

    return (
      <Box flexDirection="column">
        <els.Client key="well" module="./clients/well.ts" width="100%" props={props} />
        {LEGEND.map((row, at) => (
          <Box key={`legend-${at}`} flexDirection="row" gap={2} paddingLeft={margin}>
            {row.map(({ key, label }) => (
              <Button key={`hotkey-${key}`} hotkey={key} label={label} plain dimColor onPress={press(key)} />
            ))}
          </Box>
        ))}
      </Box>
    )
  })
}
