# Changelog

All notable changes to line-clear are listed here. Versions follow
[Semantic Versioning](https://semver.org/); while the version is 0.x, any
release may change behaviour.

## [Unreleased]

### Added

- The plugin scaffold: manifest, marketplace file and a hooks module that
  registers nothing yet.
- The game engine, pure and seeded: `newGame(seed, options)`,
  `step(state, input, nowMs)` and selectors for the visible board, ghost,
  next three, hold, score, level and lines. Seven pieces from a 7-bag,
  Super Rotation System turns and kicks, hold, gravity by level, a 500 ms
  lock delay with 15 resets, scoring for one to four rows, a level every 10
  rows, block out and lock out, and pause. Nothing plays it yet.
