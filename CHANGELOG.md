# Changelog

All notable changes to line-clear are listed here. Versions follow
[Semantic Versioning](https://semver.org/); while the version is 0.x, any
release may change behaviour.

## [0.1.0] - 2026-10-08

First release. Requires Claude Code 2.1.287 or later.

### Added

- The plugin scaffold: manifest and marketplace file.
- The game engine, pure and seeded: `newGame(seed, options)`,
  `step(state, input, nowMs)` and selectors for the visible board, ghost,
  next five, hold, score, level, lines and the clearing pause. A well 10
  wide and 18 deep; seven pieces from a 7-bag, entering flat just above the
  well and dropping one row at once; Super Rotation System turns and kicks;
  slides to the wall; hold; gravity by level; a 500 ms lock delay with 15
  resets, restored when any cell reaches a new lowest row; scoring for one
  to four rows, spins and minis by the three-corner rule, back to back,
  combos and the all clear bonus; a level every 10 rows; block out and lock
  out; and pause.
- `/line-clear` opens the game pane. Click the well to play with the arrows,
  Space and letters; or, keyboard only, ctrl+x tab and the pane's hotkeys
  `a d w q s x c p`. The status line says who has the keys; two seconds with
  no key on the clicked well pause the game and show `click to play`, since
  the game cannot observe losing the keys. Hold box (after a hold the piece
  keeps its color, the box is labelled `used` and its frame goes quiet until
  the next piece), the next five, score, level, lines and best, a ghost
  shaded in the falling piece's own color, a paused board that stays in
  view, dimmed, and a game-over card, with the next box emptied, that
  starts the next game on a click (or `p` with the pane focused).
- A lock that clears rows holds the next piece back for 200 ms while the
  rows light up and empty from the middle out; moves made meanwhile are
  dropped, and the last turn and a hold are done as the next piece enters.
  Both run on the frame clock, so no extra timer.
- Callouts for 1.5 s in the well's edges, in the game's own words: the top
  edge names the lock (`single`, `double`, `triple`, `four at once!`,
  `spin double`, `mini spin single`, `all clear!`), the bottom edge its
  extras (`back to back`, `combo 2`, `level 3`).
- A new best is an event: a game that beats the best it started against
  ends on a gold card, `✦ new best ✦` twinkling every 250 ms, with the score
  and how far it beat the old best; while the score in play is ahead, the
  best label reads `best  new!`.
- Seven piece colors of the game's own that stay distinct (CIEDE2000 of 12
  or more) for normal vision, protanopia, deuteranopia and tritanopia, and
  keep seven different codes, ghosts too, on a 256-color terminal.
- A held drop, turn, hold or pause stops acting once the key repeats, and
  left, right and down keep repeating: a key that comes again within 120 ms
  is a held key's repeat. The keyboard's first repeat comes later than that,
  so a held key acts twice, then stops.
- Slide to the wall in one move: shift with left or right, or `A` and `D`,
  on the clicked well.
- The best score is kept across sessions, the only value stored.
- `openOnTurn` setting, off by default: opens the pane, unfocused, when a
  turn starts.
- `startLevel` setting, 1 by default: the level each game starts at, 1 to
  15.

[0.1.0]: https://github.com/ilovepixelart/line-clear-mod/releases/tag/line-clear--v0.1.0
