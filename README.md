# line-clear

**A falling-block line-clearing game to play in a pane while Claude works.**

A Claude Code mod. Seven four-cell pieces fall into a ten-wide well; fill a
row and it clears. The game is its own design, with its own look.

Status: in development, not released yet.

## How to play

Type `/line-clear` to open the pane. Typed while Claude is working, the
command waits until the turn ends, so open the pane first and keep it open:
the game plays while Claude generates and runs tools.

There are two ways to give the game the keys.

- **Click the well.** Arrows, Space and the letters below go to the game.
  Escape gives the keys back to the prompt.
- **Keyboard only: ctrl+x tab.** The pane takes the focus and its Buttons'
  hotkeys play: `a` `d` `w` `q` `s` `x` `c` `p`. Escape gives the keys back.

| Move | Clicked well | Pane hotkey |
| --- | --- | --- |
| left, right | left, right arrow, or `a`, `d` | `a`, `d` |
| turn clockwise | up arrow or `w` | `w` |
| turn back | `z` or `q` | `q` |
| soft drop | down arrow or `s` | `s` |
| hard drop | Space or `x` | `x` |
| hold | `c` | `c` |
| pause | `p` | `p` |

Hold left, right or down and the piece keeps going; hold a drop, a turn,
hold or pause and it acts once. The game counts a key as held when it comes
again within 120 ms. Your system waits 225 to 660 ms before it starts
repeating a held key, so a key held just past that wait can still count
twice.

A click starts a game and, after game over, starts the next one; with the
pane focused, `p` does.

The status line under the well always says who has the keys:
`playing · Esc gives keys back` (the clicked well),
`keys: w a s d · Esc gives keys back` (the focused pane), or, in the warning
color, `click to play · or ctrl+x tab, then w a s d`, with a card over the
well, when the keys go to the prompt.

### Why click to play, and why the keyboard path has no arrows

Claude Code gives a mod's game region the keyboard only after a click on it:
no command, focus request or keybinding gives it the keys, and Escape never
reaches it (it hands the keys back). So the game cannot see when it loses the
keys. It infers it: two seconds with no key and the well takes itself as
unfocused, pauses, and shows `click to play` again; any key or click resumes
it. That pause is a guess from silence, not a signal.

Without a mouse, ctrl+x tab focuses the pane, where a Button's hotkey is one
letter or digit. The arrows and Tab belong to the pane there (they scroll and
move between Buttons), so a keyboard-only player steers with letters and
cannot send the game arrows or Space.

### Mid-turn, watch the prompt

A key the game does not have lands on the prompt, and mid-turn some of those
keys act: Escape at the prompt interrupts Claude, Left opens the background
agents view, Up pulls back a queued message. Check the status line before
pressing keys. Press Escape once to leave the game, and do not Tab around the
focused pane mid-turn: Tab can move the focus onto Claude Code's own stop
control, where Escape may cancel the turn.

The pane needs 46 columns and 23 rows. Below 46 columns it asks for room.

## Settings

| Setting | Default | What it does |
| --- | --- | --- |
| `openOnTurn` | off | Opens the pane, without taking the keys, each time a turn starts. Claude Code places a pane opened this way only on a terminal 144 columns wide (110 once you have opened line-clear yourself in a session). |

Change it in `/config`, or under `pluginConfigs["line-clear"].options` in
settings.

## Privacy

Nothing leaves the machine. The mod makes no network call and reads no
files. It keeps one value across sessions, the best score, as a number in the
plugin's own store. It hooks no tool, prompt, model or permission event, and
adds nothing to the transcript.

## The rules

The engine in [`hooks/game/`](hooks/game) is pure: no clock, no randomness,
no I/O. `newGame(seed, options)` starts a game and
`step(state, input, nowMs)` returns the next one, applying the time first
(gravity rows and locks due by `nowMs`) and then the input. The same seed and
inputs always replay the same game.

- **Well.** 10 columns by 18 visible rows, with 4 hidden rows above where
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
  piece at once; reaching a new lowest row with any cell restores all 15.
- **Score.** A lock that clears 1, 2, 3 or 4 rows scores 100, 300, 500 or 800
  times the level it was made at. A soft drop scores 1 a row, a hard drop 2.
  No combo, back-to-back or spin bonuses.
- **Levels.** Up one every 10 cleared rows from the start level.
- **Game over.** Block out (the next piece has no room to enter) or lock out
  (a piece locks with every cell in the hidden rows).
- **Pause.** Freezes gravity and the lock delay; ignores every other input.

The numbers live in [`hooks/game/rules.ts`](hooks/game/rules.ts).

In the pane, the game's time is the frame clock: each 50 ms frame moves the
game on 50 ms. When Claude Code draws frames late (measured at about 55 ms a
frame mid-turn), the game runs that much slower instead of skipping rows.
Each game's seed comes from the clock when it starts.

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

What `claude plugin validate .` reports the module hooks and calls:

- hooks: `session.start` (registers `/line-clear`), `command.run`
  (`line-clear`), `turn.start` (only with `openOnTurn` on), `ui.message` and
  `ui.render` (its own pane only);
- calls: `$.command.register`, `$.ui.open`, `$.ui.resolve`, `$.ui.invalidate`,
  `$.clock.now`, `$.store.get` and `$.store.set` (the best score), and
  `$.state` for the pane's own Button presses this session.

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
