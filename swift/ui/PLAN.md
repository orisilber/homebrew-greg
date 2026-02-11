# Greg UI — Native macOS Floating Window

## Overview

A native macOS floating window (like Raycast/Spotlight) that provides a GUI interface to Greg's LLM capabilities. Runs as a menu bar app with no dock icon.

## User Flows

### Flow 1 — Quick prompt

1. User presses the global hotkey (default: **Option+Shift+Space**) from anywhere
2. Floating panel appears centered on screen
3. Cursor is in the text input at the bottom
4. User types a prompt, hits Enter
5. LLM response appears above the input
6. User presses **Esc** or clicks outside to dismiss

### Flow 2 — Context from selection

1. User selects text in any app (e.g. a code block in VS Code)
2. User presses the global hotkey
3. Floating panel appears with the selected text shown as context (quoted/dimmed above the input)
4. User types a follow-up prompt referencing the selection
5. LLM receives both the selection and the prompt
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
│  │ Accessibility│  │ LLM       │ │
│  │ (AXUIElement)│  │ Client    │ │
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

Default: **Option+Shift+Space**

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
    "modifiers": ["Option", "Shift"]
  }
}
```

If `hotkey` is not set, defaults to Option+Shift+Space. The app watches the config file for changes and re-registers the hotkey on update.

Supported modifier values: `"Command"`, `"Option"`, `"Shift"`, `"Control"`.
Key values follow the Carbon key code names (e.g. `"Space"`, `"A"`, `"Return"`, `"F1"`, etc.).

### 5. Text Selection via Accessibility

**File**: `swift/ui/Accessibility/SelectionReader.swift`

Uses the macOS Accessibility API (`AXUIElement`) to read selected text from the frontmost app.

Flow:
1. On hotkey press, before showing the panel:
2. Get the frontmost app's PID (`NSWorkspace.shared.frontmostApplication`)
3. Create `AXUIElementCreateApplication(pid)`
4. Get the focused element (`kAXFocusedUIElementAttribute`)
5. Read selected text (`kAXSelectedTextAttribute`)
6. If non-empty, pass it to the panel as context

**Requires**: Accessibility permission (System Settings > Privacy > Accessibility)
- The app should detect if permission is missing and prompt the user
- Works without it (just no text selection feature)

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

### Phase 1 — Floating window shell
- [ ] App bundle with LSUIElement
- [ ] NSPanel that appears/disappears
- [ ] Global hotkey (Cmd+Shift+G)
- [ ] Basic SwiftUI layout (input + output area)
- [ ] Esc and click-outside to dismiss

### Phase 2 — LLM integration
- [ ] Config reader (shared config.json)
- [ ] LLM client protocol
- [ ] Anthropic provider (simplest HTTP API)
- [ ] OpenAI provider
- [ ] Gemini provider
- [ ] AFM provider (direct framework call)
- [ ] Streaming response display

### Phase 3 — Text selection
- [ ] Accessibility permission detection + prompt
- [ ] AXUIElement selected text reader
- [ ] Context banner in the UI
- [ ] Inject selection into LLM context

### Phase 4 — Polish
- [ ] Menu bar icon with quit/settings
- [ ] Animate panel in/out
- [ ] Vibrancy/blur background
- [ ] Copy response to clipboard
- [ ] History (up arrow for previous prompts)
- [ ] Error states (no API key, network failure)
