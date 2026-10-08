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
- A lock that clears rows holds the next piece back for 200 ms while the
  rows light up and empty from the middle out; moves made meanwhile are
  dropped, and the last turn and a hold are done as the next piece enters.
  The clear is called out in the well's top edge for 1.5 s: `single`,
  `double`, `triple` or `four at once!`. Both run on the frame clock, so no
  extra timer.
- A new best is an event: a game that beats the best it started against
  ends on a gold card, `✦ new best ✦` twinkling every 250 ms, with the score
  and how far it beat the old best; while the score in play is ahead, the
  best label reads `best  new!`.
- Seven piece colors of the game's own that stay distinct (CIEDE2000 of 12
  or more) for normal vision, protanopia, deuteranopia and tritanopia, and
  keep seven different codes, ghosts too, on a 256-color terminal.
- A held key acts once for a drop, a turn, hold and pause, and keeps
  repeating for left, right and down: a key that comes again within 120 ms
  is a held key's repeat.
- Slide to the wall in one move: shift with left or right, or `A` and `D`,
  on the clicked well.
- The best score is kept across sessions, the only value stored.
- `openOnTurn` setting, off by default: opens the pane, unfocused, when a
  turn starts.
- `startLevel` setting, 1 by default: the level each game starts at, 1 to
  15.
