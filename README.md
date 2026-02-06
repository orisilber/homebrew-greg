# greg

Natural language to shell commands. Ask for what you want, get the exact command.

```
$ greg show me the 5 largest files in this directory
─────────────────────────────────────────
  du -ah . | sort -rh | head -5
─────────────────────────────────────────
```

Greg uses an LLM to convert plain English into CLI commands. It sees your current directory, recent shell history, and OS — so the commands it generates are contextual, not generic.

Safe commands run immediately. Dangerous ones (file writes, deletes, sudo, etc.) ask for confirmation first.

## Install

### Homebrew (macOS)

```bash
brew tap orisilber/greg
brew install greg
```

Update to the latest version:

```bash
brew upgrade greg
```

### npm

Requires Node.js 18+.

```bash
npm install -g https://github.com/orisilber/homebrew-greg/tarball/main
```

### From source

Requires [Bun](https://bun.sh).

```bash
git clone https://github.com/orisilber/homebrew-greg.git
cd homebrew-greg
bun install
bun run build
npm link
```

## Setup

On first run, Greg walks you through picking a provider:

```
$ greg list all ts files
Welcome to Greg! Let's get you set up.

Provider:
  1 Apple Intelligence (on-device, no API key)
  2 Anthropic (Claude)
  3 OpenAI (GPT)
  4 Google Gemini
```

- **Apple Intelligence** — runs entirely on-device via Apple Foundation Models. No API key, no network calls. Requires macOS 26+ with Apple Intelligence enabled.
- **Anthropic** / **OpenAI** / **Google Gemini** — uses the respective cloud API. You'll be prompted for an API key.

Config is saved to `~/.config/greg/config.json`. Reconfigure anytime:

```bash
greg --setup
```

## Usage

### Ask for a command

```bash
greg print the content of all files with log in their names
greg find all TODO comments in this project
greg compress this folder into a tar.gz
greg show git commits from the last week
greg count lines of code by file type
```

Greg shows the command, then:
- **Safe commands** (read-only like `ls`, `cat`, `grep`, `find`, `git log`) run immediately.
- **Dangerous commands** (writes, deletes, installs, sudo, git push, etc.) ask for confirmation.

### Editor mode

Run `greg` with no arguments to open your `$EDITOR` (defaults to vim). Write a script, save and quit — Greg runs it.

```bash
greg
# vim opens, you write your script, :wq
# Greg executes it
```

### What Greg sees

Every request includes terminal context so the LLM gives accurate, relevant commands:

- Current working directory
- `ls -la` of the current directory
- Last 30 commands from your zsh history
- OS and architecture

## Providers

| Provider | Model | API Key | Network |
|---|---|---|---|
| Apple Intelligence | Apple Foundation Models | None | None (on-device) |
| Anthropic | claude-sonnet-4-20250514 | Required | Yes |
| OpenAI | gpt-4o-mini | Required | Yes |
| Google Gemini | gemini-2.0-flash | Required | Yes |

You can override the model by editing `~/.config/greg/config.json`:

```json
{
  "provider": "anthropic",
  "apiKey": "sk-ant-...",
  "model": "claude-sonnet-4-20250514"
}
```

## Development

```bash
bun install          # install deps
bun test             # run tests (71 tests across 5 files)
bun run build        # bundle to dist/greg.mjs for Node.js
bun run bin/greg.ts  # run from source
```

### Releasing

```bash
./scripts/release.sh
```

This will prompt for a version bump, then automatically:
1. Update `package.json` version
2. Build the dist bundle
3. Commit, tag, and push to GitHub
4. Download the tag tarball and compute its SHA256
5. Update the Homebrew formula in `~/homebrew-greg` and push it

## License

MIT
