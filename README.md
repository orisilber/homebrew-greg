# greg

> **Warning:** This project is vibe coded and should be used with caution.

Natural language to shell commands — plus a native macOS floating assistant.

```
$ greg show me the 5 largest files in this directory
─────────────────────────────────────────
  du -ah . | sort -rh | head -5
─────────────────────────────────────────
```

## Install

```bash
brew tap orisilber/greg
brew install greg          # CLI
brew install --cask greg   # UI app
```

## Setup

```bash
greg --setup
```

Pick a provider: **Apple Intelligence** (on-device, no API key), **Anthropic**, **OpenAI**, or **Google Gemini**. Config is saved to `~/.config/greg/config.json`.

## CLI

```bash
greg find all TODO comments in this project
greg compress this folder into a tar.gz
greg show git commits from the last week
```

Safe commands run immediately. Dangerous ones ask for confirmation. Run `greg` with no arguments to open your editor and write a longer prompt.

### Skills

Custom prompt instructions in `~/.config/greg/skills/`. Manage with `greg --skills list|new|edit|path`.

## UI

A native macOS floating window (like Raycast). Press **Ctrl+Shift+Space** from anywhere to open it.

- Streaming responses with reasoning display
- `/c` to attach clipboard text or images as context
- Up/down arrows for prompt history
- Esc or click outside to dismiss

Configure the hotkey in `~/.config/greg/config.json`:

```json
{
  "hotkey": { "key": "Space", "modifiers": ["Control", "Shift"] }
}
```

## License

MIT
