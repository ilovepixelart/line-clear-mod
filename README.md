# line-clear

**A falling-block line-clearing game to play in a pane while Claude works.**

A Claude Code mod. Seven four-cell pieces fall into a ten-wide well; fill a
row and it clears. The game is its own design, with its own look.

Status: in development. The game engine is written and tested; the pane that
plays it is not built yet, so installing the plugin today shows nothing.

## The rules

The engine in [`hooks/game/`](hooks/game) is pure: no clock, no randomness,
no I/O. `newGame(seed, options)` starts a game and
`step(state, input, nowMs)` returns the next one, applying the time first
(gravity rows and locks due by `nowMs`) and then the input. The same seed and
inputs always replay the same game.

- **Well.** 10 columns by 20 visible rows, with 4 hidden rows above where
  pieces enter.
- **Pieces.** Seven four-cell pieces, dealt from a 7-bag (each run of seven
  holds one of each) shuffled by a seeded generator. The next three are shown.
- **Turning.** Super Rotation System states and wall kicks, from its published
  kick table ([`hooks/game/pieces.ts`](hooks/game/pieces.ts)). The square
  never kicks.
- **Hold.** Once per piece; allowed again when a piece locks.
- **Gravity.** `(0.8 - (level - 1) * 0.007) ^ (level - 1)` seconds a row:
  1000 ms at level 1, 355 ms at level 5, 64 ms at level 10, and no faster than
  level 15's 7 ms.
- **Lock delay.** A resting piece locks after 500 ms. Each of the first 15
  moves or turns made while resting restarts the delay, and the 16th locks the
  piece at once; reaching a new lowest row restores all 15.
- **Score.** A lock that clears 1, 2, 3 or 4 rows scores 100, 300, 500 or 800
  times the level it was made at. A soft drop scores 1 a row, a hard drop 2.
  No combo, back-to-back or spin bonuses.
- **Levels.** Up one every 10 cleared rows from the start level.
- **Game over.** Block out (the next piece has no room to enter) or lock out
  (a piece locks with every cell in the hidden rows).
- **Pause.** Freezes gravity and the lock delay; ignores every other input.

The numbers live in [`hooks/game/rules.ts`](hooks/game/rules.ts).

## Install

Requires Claude Code 2.1.287 or later (mods).

Straight from this repository, following `main`:

```
/plugin install line-clear --marketplace ilovepixelart/line-clear-mod
```

To try it from a clone without installing: `claude --plugin-dir /path/to/line-clear-mod`.

## Versioning

Releases follow [Semantic Versioning](https://semver.org/). While the version
is 0.x, any release may change behaviour. [CHANGELOG.md](CHANGELOG.md) lists
what each release changed.

## Access

What `claude plugin validate .` reports the module calls: nothing yet.

## Development

```sh
node scripts/gates.mjs          # release check, validate, test, typecheck
node scripts/gates.mjs --load   # also the tests eight times at once
```

Both workflows run the same script, so a green local run is the check CI
makes.

`tsc` needs the type declarations Claude Code writes into
`.claude-plugin/types/` when it loads the plugin; the gates write them with a
`claude --plugin-dir . -p` run when they are missing, which works even when it
stops at "Not logged in".

To release, add the version's section to `CHANGELOG.md`, set the version in
`.claude-plugin/plugin.json` (its only home), merge, then run
`claude plugin tag --push` on `main`. The pushed `line-clear--v<version>` tag
starts the release workflow, which runs the gates again with the tag checked
against the version and publishes the GitHub release with the CHANGELOG
section as notes, `line-clear-<version>.zip` for `claude --plugin-url`, and the
zip's `.sha256`.

## License

MIT
