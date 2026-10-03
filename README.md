# greg

Natural language to shell commands.

```bash
greg show me the 5 largest files in this directory
greg --preview find all TODO comments in this project
greg --copy compress this folder into a tar.gz
greg --timings show git commits from the last week
```

Greg makes one generation request per prompt. It streams a live preview in a
terminal, then checks the completed command before executing it. Simple recognized
read commands run immediately. Commands that may write files, unknown programs,
and compound shell commands require an explicit `y` or `yes`. Pressing Enter
alone declines. These checks control confirmation; they are not a shell sandbox.

## Install

```bash
brew tap orisilber/greg
brew install greg
```

## Setup

```bash
greg --setup
```

Choose Apple Intelligence for on-device generation without an API key, or use
Anthropic, OpenAI, Google Gemini, or OpenRouter. Apple Intelligence requires a
supported Mac, Apple Intelligence enabled, and Xcode Command Line Tools to compile
the bridge.

## Options

| Option | Behavior |
| --- | --- |
| `--preview` | Print the completed command to stdout without executing it. |
| `--copy` | Print the command and copy it to the macOS clipboard without executing it. |
| `--timings` | Print local context, first-text, generation, and total generation times to stderr. |
| `--timeout MS` | Set the generation deadline, from 1 to 600000 milliseconds. |
| `--no-stream` | Hide the live preview. |
| `--setup` | Configure the provider and API key. |
| `--help` | Show usage. |

Place options before the request. Use `--` if the request begins with a dash.
Run `greg` with no request to write one in your editor, selected by `EDITOR`.

The default generation deadline is 30 seconds. Ctrl+C cancels generation.
Interrupted, truncated, and failed responses never execute. The deadline also
covers the first compilation of the Apple Intelligence bridge; use a longer
`--timeout` if needed. Greg caches that bridge and rebuilds it when its source
changes.

Diagnostics and live previews go to stderr. Piping `greg --preview` produces only
the completed command on stdout. Commands requiring confirmation cannot execute
when stdin is not a terminal.

## Configuration

Setup saves `~/.config/greg/config.json` with owner-only permissions. Edit that
file to change the provider, model, or these optional settings:

| Setting | Default | Behavior |
| --- | --- | --- |
| `customInstructions` | Empty | Add preferences such as "Prefer rg for searches and jq for JSON." to each request. |
| `includeHistory` | `false` | Include up to 10 recent zsh history lines for cloud providers, or 5 for Apple Intelligence, from a bounded 16 KiB read. |
| `timeoutMs` | `30000` | Set the generation deadline unless overridden by `--timeout`. |

Greg supplies the working directory, OS, and a limited directory listing.
History stays local unless you enable `includeHistory`; enabling it sends the
selected history lines to your configured provider. Timings contain durations
only and are printed locally.

Skills and `--skills` have been removed. Move any preferences you still want
from old skill files into `customInstructions`. Greg does not read or delete
those files.

Set `GREG_CONFIG_DIR` to use a separate configuration directory. This is useful
for temporary environments and tests.

## Development

```bash
bun install
bun run check
bun run test
```

Tests build and exercise the CLI, use temporary configuration, and redirect
cloud requests to local HTTP fixtures. Terminal checks use Python 3. On macOS,
the suite also compiles and checks the Apple Intelligence bridge.

## License

MIT
