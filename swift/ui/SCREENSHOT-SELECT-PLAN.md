# /ss — Interactive Screenshot Region Selection

## Overview

Add a `/ss` slash command that lets the user select a region of the screen to capture as context. Complements the existing `/s` (full window screenshot) command.

## User Flow

1. User is in Chrome (or any app), presses hotkey to open Greg
2. Types `/ss what's this error?` and hits Enter
3. Greg panel hides temporarily
4. Screen dims with a semi-transparent overlay, cursor becomes a crosshair
5. User clicks and drags to select a rectangle (live selection highlight)
6. On mouse release, that region is captured
7. Greg panel reappears with the cropped screenshot as image context
8. LLM response streams in

Cancel: pressing Esc during selection cancels and returns to the Greg panel without capturing.

## Technical Plan

### Phase 1 — Selection Overlay Window

**New file**: `Sources/SelectionOverlay.swift`

A full-screen transparent `NSWindow` that handles the region selection interaction.

- **Window setup**:
  - Borderless, transparent `NSWindow` (not NSPanel)
  - Level set above everything (`.screenSaver` or `.statusBar + 1`)
  - Covers the entire screen (all displays if multi-monitor)
  - Background: semi-transparent dark fill (e.g. black at 30% opacity)

- **Custom NSView** (`SelectionView`):
  - Tracks `mouseDown`, `mouseDragged`, `mouseUp`
  - `mouseDown`: records the anchor point
  - `mouseDragged`: updates the selection rect, calls `needsDisplay = true`
  - `mouseUp`: finalizes the selection rect, calls the completion handler
  - `draw(_:)`: fills the entire view with the dim color, then clears (punches out) the selected rectangle so the underlying screen shows through
  - Cursor set to crosshair via `NSCursor.crosshair`

- **Escape handling**: `keyDown` with keyCode 53 cancels the selection and calls the cancel handler

- **Completion callback**: `(NSRect?) -> Void` — returns the selected rect in screen coordinates, or nil if cancelled

### Phase 2 — Screenshot Capture with Region

**Modified file**: `Sources/ScreenshotCapture.swift`

Add a new method for region-based capture:

```swift
@available(macOS 14.0, *)
static func captureRegion(_ rect: NSRect) async -> ImageContext?
```

Implementation:
- Use `SCShareableContent` to get the main display
- Create an `SCContentFilter` for the display
- Configure `SCStreamConfiguration` with `sourceRect` set to the selected region (converted to display coordinates) and `width`/`height` matching the selection size
- Use `SCScreenshotManager.captureImage` with that filter + config
- Convert the resulting `CGImage` to PNG base64, return as `ImageContext`

### Phase 3 — Wire into PanelState Submit Flow

**Modified file**: `Sources/PanelState.swift`

The `/ss` command requires a two-phase submit:

1. **Pre-submit** (synchronous): detect `/ss` is active, save the prompt, hide the panel
2. **Selection phase** (async): show the overlay, wait for user selection
3. **Post-selection** (async): capture the region, set as imageContext, send to LLM

Add a method:

```swift
func submitWithSelection(hidePanel: () -> Void, showPanel: () -> Void)
```

Or alternatively, add a callback-based approach:
- `PanelState` gets an `onRequestSelection: ((NSRect?) -> Void) -> Void` closure (set by AppDelegate)
- When `/ss` is active in submit, PanelState calls `onRequestSelection` with a completion
- AppDelegate hides the panel, shows the overlay, and on completion passes the rect back

### Phase 4 — AppDelegate Orchestration

**Modified file**: `Sources/AppDelegate.swift`

AppDelegate coordinates the panel and overlay:

1. Set `panelState.onRequestSelection` during init
2. When called:
   - Hide the Greg panel
   - Wait a short delay (e.g. 100ms) for the panel to animate out
   - Create and show the `SelectionOverlay`
   - On completion: capture the region, set imageContext, re-show the panel, continue the LLM call
   - On cancel: re-show the panel, clear loading state

### Phase 5 — Register the Slash Command

**Modified file**: `Sources/ContentView.swift`

Add to `slashCommands` array:

```swift
SlashCommand(command: "/ss", name: "select", description: "Screenshot a selected region"),
```

Update `restoreHistoryEntry` known commands in `PanelState.swift` to include `/ss`.

## Implementation Order

1. SelectionOverlay.swift — the overlay window + selection view (can be tested standalone)
2. ScreenshotCapture.captureRegion — region-based capture method
3. PanelState + AppDelegate wiring — the callback plumbing
4. ContentView — register the command
5. Test end-to-end

## Edge Cases

- **Multi-monitor**: selection overlay should cover all screens, capture from the correct display
- **Tiny selection**: ignore selections smaller than ~5x5 pixels (likely accidental clicks)
- **Escape during drag**: treat as cancel
- **Screen Recording permission**: same requirement as `/s`, show error if denied
- **macOS < 14**: show error message (same as `/s`)
