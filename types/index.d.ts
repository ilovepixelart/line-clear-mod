/** One press of a pane Button: its hotkey letter, numbered so the game applies it once. */
export type LineClearPress = { seq: number; key: string }

declare module 'claude-code' {
  interface PluginState {
    'line-clear': {
      /** The latest pane Button presses, for the game region to apply; the session's only. */
      presses: LineClearPress[]
    }
  }
}
