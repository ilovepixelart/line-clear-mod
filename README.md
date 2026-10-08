# line-clear

**A falling-block line-clearing game to play in a pane while Claude works.**

A Claude Code mod. Seven four-cell pieces fall into a ten-wide well; fill a
row and it clears. The game is its own design, with its own look.

Status: in development. The game engine is written and tested; the pane that
plays it is not built yet, so installing the plugin today shows nothing.

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
