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
claude plugin validate --strict .
claude plugin test .
npx -p typescript tsc -p .
```

`tsc` needs the type declarations Claude Code writes into
`.claude-plugin/types/` when it loads the plugin; any `claude --plugin-dir .`
run writes them, even one that stops at "Not logged in".

## License

MIT
