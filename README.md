# greg

> **Warning:** This project is vibe coded and should be used with caution. It may contain bugs, rough edges, and unconventional design decisions. Use at your own risk.

Natural language to shell commands — plus a native macOS floating assistant.

Greg has two interfaces:

- **CLI** — type `greg <what you want>` in your terminal and get the exact shell command
- **UI** — press a hotkey from anywhere to chat with an LLM in a floating window

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

## CLI Usage

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

Run `greg` with no arguments to open your `$EDITOR` (defaults to vim). Write a prompt, save and quit — Greg generates a command from it.

```bash
greg
# vim opens, you write your prompt, :wq
# Greg generates and runs the command
```

### Skills

Skills are markdown files that inject extra instructions into the LLM prompt when relevant. They live in `~/.config/greg/skills/`.

```bash
greg --skills list        # list all skills
greg --skills path        # show skills directory
greg --skills new myskill # create a new skill
greg --skills edit myskill # edit an existing skill
```

A skill file looks like:

```markdown
---
description: git version control commits branches
---

Always use conventional commit messages.
Prefer rebase over merge.
```

Skills with a `description` are matched by keyword overlap with your prompt. Skills without a description are always active.

### What Greg sees

Every request includes terminal context so the LLM gives accurate, relevant commands:

- Current working directory
- `ls -la` of the current directory
- Last 30 commands from your zsh history
- OS and architecture

## UI — Floating Window

Greg includes a native macOS floating window (similar to Raycast/Spotlight) for chatting with an LLM from anywhere.

### Running the UI

```bash
cd swift/ui
bash build.sh
open build/Greg.app
```

The app runs as a menu bar app (no dock icon). Press the global hotkey to toggle the floating panel.

### Default hotkey

**Ctrl+Shift+Space** — opens/closes the floating window.

### Custom hotkey

Add a `hotkey` field to `~/.config/greg/config.json`:

```json
{
  "provider": "anthropic",
  "apiKey": "sk-ant-...",
  "model": "claude-sonnet-4-20250514",
  "hotkey": {
    "key": "Space",
    "modifiers": ["Control", "Shift"]
  }
}
```

Supported modifiers: `Command`, `Option`, `Shift`, `Control`. Key values: `Space`, `A`–`Z`, `Return`, `F1`–`F12`, etc.

### Features

- **Streaming responses** — tokens appear in real-time as the LLM generates them
- **Reasoning display** — thinking/reasoning tokens show in a dimmed rolling window above the response
- **Clipboard context** — copy text or an image, then use `/c` or click "Use as context" to attach it
- **Image context** — copy a screenshot or image, use `/c` to send it to the LLM (Anthropic, OpenAI, Gemini — not AFM)
- **Slash commands** — type `/` to see available commands with descriptions; commands appear as chips
- **History** — press up/down arrows to navigate previous prompts
- **Dismiss** — Esc, click outside, Cmd+Tab, or press the hotkey again

### Slash commands

| Command | Name | Description |
|---|---|---|
| `/c` | clipboard | Attach clipboard content (text or image) as context |

## Providers

| Provider | Model | API Key | Network |
|---|---|---|---|
| Apple Intelligence | Apple Foundation Models | None | None (on-device) |
| Anthropic | claude-sonnet-4-20250514 | Required | Yes |
| OpenAI | gpt-4o-mini | Required | Yes |
| Google Gemini | gemini-2.5-flash | Required | Yes |

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
bun test             # run tests (98 tests across 10 files)
bun run build        # bundle to dist/greg.mjs for Node.js
bun run bin/greg.ts  # run CLI from source
```

### Building the UI

```bash
cd swift/ui
bash build.sh        # compiles and signs Greg.app
open build/Greg.app  # launch it
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
5. Update the Homebrew formula and push it

## License

MIT
