import type { CommandRunInput, On, RenderPropsOf, UiOpenResult } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { mock } from 'claude-code/testing'

export const PLUGIN = 'line-clear'
export const PANE = 'line-clear'

export const SESSION = { surface: 'terminal', isInteractive: true, cwd: '/work' } as const

export const COMMAND: CommandRunInput = { command: 'line-clear', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } }

/** The pane as the terminal hands it to the hook: unfocused unless a test says so. */
export const paneProps = (bodyColumns = 80, isFocused = false): RenderPropsOf['Pane'] => ({
  title: 'line-clear',
  isFocused,
  bodyColumns,
  placement: 'inline',
  scroll: { offset: 0, bodyRows: 30 },
  view: {},
})

/**
 * The world beneath the plugin: a session, commands that register, panes
 * that open (each open recorded), a store the test reads afterwards (each
 * read recorded), and a
 * clock in memory.
 */
export function inSession(on: On, entries: Record<string, unknown> = {}): { opened: unknown[]; store: Map<string, unknown>; reads: string[]; clock: ReturnType<typeof mock.clock> } {
  const opened: unknown[] = []
  const store = new Map<string, unknown>(Object.entries(entries))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('ui.open', (_$, e) => {
    opened.push(e)

    return { value: { isPlaced: true } satisfies UiOpenResult }
  })
  const reads: string[] = []
  on('store.get', (_$, e) => {
    reads.push(e.key)

    return { value: store.get(e.key) }
  })
  on('store.set', (_$, e) => {
    store.set(e.key, e.value)

    return { value: undefined }
  })

  return { opened, store, reads, clock: mock.clock(on) }
}

export async function mounted($: Engine, bodyColumns = 80, isFocused = false) {
  return $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PANE, props: paneProps(bodyColumns, isFocused) })
}

type Drawn = { type?: string; props?: Record<string, unknown>; children?: unknown[] }

const strings = (node: unknown): string[] => {
  if (typeof node === 'string') {
    return [node]
  }
  const drawn = node as Drawn
  const children = drawn.children ?? (drawn.props?.children as unknown)
  if (children === undefined) {
    return []
  }

  return Array.isArray(children) ? children.flatMap(strings) : strings(children)
}

/** The game region's lines as drawn: one per Text of its column. */
export async function wellLines(ui: { drawn: (scope?: { in?: string }) => Promise<unknown> }): Promise<string[]> {
  const root = (await ui.drawn({ in: 'well' })) as Drawn
  const lines = root.children ?? (root.props?.children as unknown[]) ?? []

  return lines.map(line => strings(line).join(''))
}

/** Every string the game region drew. */
export async function wellStrings(ui: { drawn: (scope?: { in?: string }) => Promise<unknown> }): Promise<string[]> {
  return strings(await ui.drawn({ in: 'well' }))
}

/** Where the ghost's leftmost cell is drawn on the lowest row that holds one, as a character column. */
export async function ghostColumn(ui: { drawn: (scope?: { in?: string }) => Promise<unknown> }): Promise<number> {
  const lines = await wellLines(ui)
  const row = lines.findLast(line => line.includes('░'))

  return row === undefined ? -1 : row.indexOf('░')
}

export const statusOf = async (ui: { drawn: (scope?: { in?: string }) => Promise<unknown> }) => (await wellLines(ui)).at(-1)?.trim()
