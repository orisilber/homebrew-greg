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
| `--no-context` | Skip reading and saving terminal memory for this request. |
| `--forget` | Clear this terminal's memory without making a model request. |
| `--version` | Show the installed version. |
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

## Follow-up requests

Greg remembers recent commands in the current terminal. You can build on a
command it generated, including one you only previewed:

```bash
greg --preview find PDF files here
greg --preview same thing but recursively
greg --preview only show the first 5
```

After an executed command, Greg also remembers its exit status and a bounded
excerpt of stdout and stderr. You can ask it to fix an error or refine the result.
Previewed, copied, declined, and blocked commands are recorded as not executed.

Each terminal has separate memory. Greg stores up to five recent turns locally
with owner-only permissions, and sends a smaller excerpt to your configured model
on the next request. Apple Intelligence receives less context to fit its smaller
context window. Context expires after 24 hours; inactive terminal records are
cleaned up when Greg next saves a turn. Greg does not capture commands you run
outside Greg or read the terminal's scrollback.

Use `greg --forget` to clear this terminal's memory. Use `--no-context` before a
request to skip reading and saving memory for that one turn, or set
`rememberSession` to `false` to disable memory altogether. In scripts, set a
unique `GREG_SESSION_ID` to give related requests a shared session. Without a
terminal or session ID, Greg runs without memory.

## Configuration

Setup saves `~/.config/greg/config.json` with owner-only permissions. Edit that
file to change the provider, model, or these optional settings:

| Setting | Default | Behavior |
| --- | --- | --- |
| `customInstructions` | Empty | Add preferences such as "Prefer rg for searches and jq for JSON." to each request. |
| `includeHistory` | `false` | Include up to 10 recent zsh history lines for cloud providers, or 5 for Apple Intelligence, from a bounded 16 KiB read. |
| `rememberSession` | `true` | Remember Greg commands and bounded output in the current terminal. |
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

To publish a version after committing and pushing the feature:

```bash
bash scripts/release.sh 0.5.0
```

The release script checks the CLI, tags and publishes the release, and updates
the Homebrew formula with the archive checksum.

## License

MIT
