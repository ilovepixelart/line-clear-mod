# Changelog

All notable changes to line-clear are listed here. Versions follow
[Semantic Versioning](https://semver.org/); while the version is 0.x, any
release may change behaviour.

## [Unreleased]

### Added

- The plugin scaffold: manifest and marketplace file.
- The game engine, pure and seeded: `newGame(seed, options)`,
  `step(state, input, nowMs)` and selectors for the visible board, ghost,
  next three, hold, score, level and lines. Seven pieces from a 7-bag,
  Super Rotation System turns and kicks, hold, gravity by level, a 500 ms
  lock delay with 15 resets, scoring for one to four rows, a level every 10
  rows, block out and lock out, and pause.
- `/line-clear` opens the game pane. Click the well to play with the arrows,
  Space and letters; or, keyboard only, ctrl+x tab and the pane's hotkeys
  `a d w q s x c p`. The status line says who has the keys; two seconds with
  no key on the clicked well pause the game and show `click to play`, since
  the game cannot observe losing the keys. Hold box (after a hold the piece
  keeps its color, the box is labelled `used` and its frame goes quiet until
  the next piece), the next three, score,
  level, lines and best, a ghost shaded in the falling piece's own color,
  and a game-over card that starts the next game on a click (or `p` with the
  pane focused).
- The best score is kept across sessions, the only value stored.
- `openOnTurn` setting, off by default: opens the pane, unfocused, when a
  turn starts.
