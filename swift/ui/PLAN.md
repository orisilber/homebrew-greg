# Greg UI — Native macOS Floating Window

## Overview

A native macOS floating window (like Raycast/Spotlight) that provides a GUI interface to Greg's LLM capabilities. Runs as a menu bar app with no dock icon.

## User Flows

### Flow 1 — Quick prompt

1. User presses the global hotkey (default: **Ctrl+Shift+Space**) from anywhere
2. Floating panel appears centered on screen
3. Cursor is in the text input at the bottom
4. User types a prompt, hits Enter
5. LLM response appears above the input
6. User presses **Esc** or clicks outside to dismiss

### Flow 2 — Context from clipboard

1. User copies text in any app (Cmd+C)
2. User presses the global hotkey
3. Floating panel appears with clipboard preview and "Use as context" button
4. User clicks the button (or types `/c question` to auto-attach clipboard)
5. LLM receives both the clipboard context and the prompt
6. Response appears above the input
7. Esc or click outside to dismiss

## Architecture

```
┌──────────────────────────────────┐
│          Greg.app (Swift)        │
│                                  │
│  ┌─────────────┐  ┌───────────┐ │
│  │ Global       │  │ Floating  │ │
│  │ Hotkey       │──│ Panel     │ │
│  │ Listener     │  │ (SwiftUI) │ │
│  └─────────────┘  └───────────┘ │
│                                  │
│  ┌─────────────┐  ┌───────────┐ │
│  │ Clipboard    │  │ LLM       │ │
│  │ Reader       │  │ Client    │ │
│  └─────────────┘  └───────────┘ │
│                                  │
│  ┌─────────────────────────────┐ │
│  │ Config (reads ~/.config/    │ │
│  │         greg/config.json)   │ │
│  └─────────────────────────────┘ │
└──────────────────────────────────┘
```

## UI Layout

```
┌─────────────────────────────────────────┐
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ [Context: selected text, if any]  │  │  ← dimmed, quoted, collapsible
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │                                   │  │
│  │   LLM response appears here      │  │  ← scrollable, monospace
│  │   (streams in as it arrives)      │  │
│  │                                   │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ Ask Greg...                       │  │  ← text input, auto-focused
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

Window properties:
- **Size**: ~600x400, centered on active screen
- **Style**: Rounded corners, vibrancy/blur background (NSVisualEffectView)
- **Level**: Floating above all windows (NSPanel with `.floating` level)
- **Behavior**: Non-activating (doesn't steal focus from other apps beyond what's needed)

## Technical Components

### 1. App Bundle & Lifecycle

**Directory**: `swift/ui/`
**Type**: macOS app, menu bar only (LSUIElement = true, no dock icon)

Files:
- `GregApp.swift` — App entry point, sets up menu bar item + hotkey
- `Info.plist` — Bundle config, accessibility usage description, LSUIElement

The app runs in the background. No dock icon. Optional menu bar icon for settings/quit.

### 2. Floating Panel

**File**: `swift/ui/Panel/FloatingPanel.swift`

Use `NSPanel` (not `NSWindow`) because:
- Supports `.nonactivatingPanel` style (doesn't deactivate the frontmost app)
- Can be set to `.floating` level
- Standard for utility/palette windows

Behavior:
- Appears on Cmd+Shift+G
- Centers on the screen containing the mouse cursor
- Dismisses on:
  - Esc key
  - Click outside the panel
  - Hotkey again (toggle)
- Animates in/out (fade + slight scale)

### 3. SwiftUI Views

**Directory**: `swift/ui/Views/`

Files:
- `PanelContentView.swift` — Main layout (context + response + input)
- `ContextBanner.swift` — Shows selected text context (if any)
- `ResponseView.swift` — Scrollable, monospace LLM output with streaming
- `InputField.swift` — Text input with Enter to submit

### 4. Global Hotkey

**File**: `swift/ui/Hotkey/HotkeyManager.swift`

Use Carbon's `RegisterEventHotKey` API — it's the most reliable for global hotkeys on macOS and doesn't require accessibility permissions just for the hotkey itself.

Default: **Ctrl+Shift+Space**

```
hotkey → togglePanel()
```

If the panel is hidden → capture selection (if any) → show panel
If the panel is visible → hide panel

The hotkey is user-configurable via `~/.config/greg/config.json`:

```json
{
  "provider": "anthropic",
  "apiKey": "sk-...",
  "model": "claude-sonnet-4-20250514",
  "hotkey": {
    "key": "Space",
    "modifiers": ["Control", "Shift"]
  }
}
```

If `hotkey` is not set, defaults to Ctrl+Shift+Space. The app watches the config file for changes and re-registers the hotkey on update.

Supported modifier values: `"Command"`, `"Option"`, `"Shift"`, `"Control"`.
Key values follow the Carbon key code names (e.g. `"Space"`, `"A"`, `"Return"`, `"F1"`, etc.).

### 5. Clipboard Context

**File**: `swift/ui/Sources/ClipboardReader.swift`

Reads text from `NSPasteboard.general` for use as LLM context.

Two ways to add context:
1. **`/c` prefix** — type `/c your question` and the clipboard is automatically injected as context
2. **"Use as context" button** — when the clipboard has text, a banner appears offering to use it

No special permissions required. Works with any app — just Cmd+C first.

### 6. LLM Client (Native Swift)

**Directory**: `swift/ui/LLM/`

Native Swift HTTP calls using `URLSession` — no shelling out to Node.js. This gives us:
- Streaming support (SSE parsing for real-time response display)
- Lower latency (no process spawn overhead)
- Native async/await

Files:
- `LLMClient.swift` — Protocol/interface for all providers
- `AnthropicClient.swift` — Anthropic Messages API
- `OpenAIClient.swift` — OpenAI Chat Completions API
- `GeminiClient.swift` — Google Gemini API
- `AFMClient.swift` — Apple Foundation Models (direct framework access, no bridge needed)

The AFM path is much simpler here — call the framework directly from Swift instead of going through the compiled bridge binary.

### 7. Shared Config

**File**: `swift/ui/Config/GregConfig.swift`

Reads the same `~/.config/greg/config.json` that the CLI uses. Shared config means:
- `greg --setup` configures both CLI and UI
- No separate setup flow needed for the app
- Same provider, API key, model

```swift
struct HotkeyConfig: Codable {
    let key: String          // e.g. "Space", "A", "Return"
    let modifiers: [String]  // e.g. ["Option", "Shift"]
}

struct GregConfig: Codable {
    let provider: String     // "afm" | "anthropic" | "openai" | "gemini"
    let apiKey: String?
    let model: String?
    let hotkey: HotkeyConfig? // defaults to Option+Shift+Space
}
```

### 8. System Prompt

The UI app uses a different system prompt than the CLI — it's not restricted to generating shell commands. It should be a general assistant that can answer questions, explain code, etc. The selected text context is injected into the user message.

## Build & Distribution

### Development

```bash
# Build the app
cd swift/ui
xcodebuild -scheme Greg -configuration Debug

# Or open in Xcode
open swift/ui/Greg.xcodeproj
```

### Homebrew

Add a cask alongside the existing formula:

```
Formula/greg.rb     — CLI (brew install greg)
Casks/greg.rb       — App (brew install --cask greg)
```

The cask installs `Greg.app` into `/Applications`.

## Implementation Order

### Phase 1 — Floating window shell ✅
- [x] App bundle with LSUIElement
- [x] NSPanel that appears/disappears
- [x] Global hotkey (Ctrl+Shift+Space)
- [x] Basic SwiftUI layout (input + output area)
- [x] Esc, click-outside, and lose-focus to dismiss

### Phase 2 — LLM integration ✅
- [x] Config reader (shared config.json)
- [x] LLM client protocol
- [x] Anthropic provider
- [x] OpenAI provider
- [x] Gemini provider
- [x] AFM provider (direct Foundation Models call)
- [x] Async response display with loading state

### Phase 3 — Context from clipboard ✅
- [x] `/c` prefix command to pull clipboard into context
- [x] "Use as context" button when clipboard has text
- [x] Context banner in the UI (collapsible, char count)
- [x] Inject context into LLM prompt

### Phase 4 — Polish & Streaming
- [x] Streaming responses (URLSession AsyncBytes, SSE parsing per provider)
- [x] Reasoning vs response in different colors (reasoning = dimmed 35% opacity, response = primary)
- [x] Reasoning block: rolling 4-line window (stream in, drop oldest lines when exceeding 4)
- [x] Menu bar icon with quit (done in Phase 1)
- [x] Animate panel in/out (fade + scale, 0.15s ease-out in, 0.1s ease-in out)
- [x] Vibrancy/blur background (done in Phase 1, NSVisualEffectView .hudWindow)
- [x] ~~Cmd+C copies full response~~ (removed — not needed)
- [x] History (up/down arrow to navigate previous prompts within session)
- [x] Slash commands UX: tooltip appears above input when typing `/`, shows available commands with descriptions
- [x] Error states (red icon + message for no config, API errors, network failures)

### Phase 5 — Image context (multimodal)
- [ ] Read image types from NSPasteboard (.png, .tiff) on `/c` or clipboard offer
- [ ] Convert to base64 PNG
- [ ] Show image thumbnail in context banner
- [ ] Anthropic: send as image content block (base64, media_type)
- [ ] OpenAI: send as image_url content part (base64 data URI)
- [ ] Gemini: send as inlineData part (base64, mimeType)
- [ ] AFM: show unsupported message (no vision support)
- [ ] Update LLMClient protocol to accept optional image data
