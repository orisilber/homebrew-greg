import Foundation

// ─── Simple test runner ─────────────────────────────────────────────────────

var passed = 0
var failed = 0
var currentGroup = ""

func group(_ name: String) {
    currentGroup = name
    print("  \(name)")
}

func assert(_ condition: Bool, _ message: String, file: String = #file, line: Int = #line) {
    if condition {
        passed += 1
        print("    ✓ \(message)")
    } else {
        failed += 1
        print("    ✗ FAIL [\(line)]: \(message)")
    }
}

func assertEqual<T: Equatable>(_ a: T, _ b: T, _ message: String, file: String = #file, line: Int = #line) {
    if a == b {
        passed += 1
        print("    ✓ \(message)")
    } else {
        failed += 1
        print("    ✗ FAIL [\(line)]: \(message) — got '\(a)', expected '\(b)'")
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// containsCommand
// ═══════════════════════════════════════════════════════════════════════════════

group("containsCommand")

assert(CommandProcessor.containsCommand("/c hello", "/c"), "at start with space")
assert(CommandProcessor.containsCommand("/c", "/c"), "exact match")
assert(CommandProcessor.containsCommand("hello /c world", "/c"), "in middle")
assert(CommandProcessor.containsCommand("hello /c", "/c"), "at end")
assert(!CommandProcessor.containsCommand("hello world", "/c"), "not present")
assert(!CommandProcessor.containsCommand("abc/c", "/c"), "substring abc/c")
assert(!CommandProcessor.containsCommand("/cat", "/c"), "substring /cat")
assert(CommandProcessor.containsCommand("/c\nhello", "/c"), "command before newline")
assert(CommandProcessor.containsCommand("hello /c\nworld", "/c"), "command in middle before newline")
assert(!CommandProcessor.containsCommand("", "/c"), "empty string")
assert(!CommandProcessor.containsCommand("/", "/c"), "just a slash")

// ═══════════════════════════════════════════════════════════════════════════════
// stripCommand
// ═══════════════════════════════════════════════════════════════════════════════

group("stripCommand")

assertEqual(CommandProcessor.stripCommand("/c hello world", "/c"), "hello world", "prefix")
assertEqual(CommandProcessor.stripCommand("hello /c world", "/c"), "hello world", "middle")
assertEqual(CommandProcessor.stripCommand("hello world /c", "/c"), "hello world", "suffix")
assertEqual(CommandProcessor.stripCommand("/c", "/c"), "", "only command")
assertEqual(CommandProcessor.stripCommand("  /c  ", "/c"), "", "command with whitespace")

// ═══════════════════════════════════════════════════════════════════════════════
// processInput — basic activation
// ═══════════════════════════════════════════════════════════════════════════════

group("processInput — basic activation")

do {
    let (input, active) = CommandProcessor.processInput(
        "/c ", knownCommands: ["/c"], alreadyActive: []
    )
    assertEqual(input, "", "'/c ' -> empty input")
    assertEqual(active, ["/c"], "'/c ' -> activates /c")
}

do {
    let (input, active) = CommandProcessor.processInput(
        "/c hello world", knownCommands: ["/c"], alreadyActive: []
    )
    assertEqual(input, "hello world", "'/c hello world' -> 'hello world'")
    assertEqual(active, ["/c"], "'/c hello world' -> activates /c")
}

// ═══════════════════════════════════════════════════════════════════════════════
// processInput — command in middle
// ═══════════════════════════════════════════════════════════════════════════════

group("processInput — command in middle")

do {
    let (input, active) = CommandProcessor.processInput(
        "explain /c this", knownCommands: ["/c"], alreadyActive: []
    )
    assertEqual(input, "explain this", "'explain /c this' -> 'explain this'")
    assertEqual(active, ["/c"], "middle -> activates /c")
}

// ═══════════════════════════════════════════════════════════════════════════════
// processInput — no command / no match
// ═══════════════════════════════════════════════════════════════════════════════

group("processInput — no command / no match")

do {
    let (input, active) = CommandProcessor.processInput(
        "hello world", knownCommands: ["/c"], alreadyActive: []
    )
    assertEqual(input, "hello world", "no command -> unchanged")
    assertEqual(active, [], "no command -> empty active")
}

do {
    let (input, active) = CommandProcessor.processInput(
        "/c", knownCommands: ["/c"], alreadyActive: []
    )
    assertEqual(input, "/c", "'/c' without space -> not activated")
    assertEqual(active, [], "'/c' without space -> empty active")
}

do {
    let (input, active) = CommandProcessor.processInput(
        "/cat hello", knownCommands: ["/c"], alreadyActive: []
    )
    assertEqual(input, "/cat hello", "/cat -> not matching /c")
    assertEqual(active, [], "/cat -> no activation")
}

// ═══════════════════════════════════════════════════════════════════════════════
// processInput — already active (no duplicate)
// ═══════════════════════════════════════════════════════════════════════════════

group("processInput — already active")

do {
    let (input, active) = CommandProcessor.processInput(
        "/c hello", knownCommands: ["/c"], alreadyActive: ["/c"]
    )
    assertEqual(input, "/c hello", "already active -> input unchanged")
    assertEqual(active, ["/c"], "already active -> no duplicate")
}

// ═══════════════════════════════════════════════════════════════════════════════
// processInput — command at end with trailing space
// ═══════════════════════════════════════════════════════════════════════════════

group("processInput — command at end")

do {
    let (input, active) = CommandProcessor.processInput(
        "hello /c ", knownCommands: ["/c"], alreadyActive: []
    )
    assert(active.contains("/c"), "'hello /c ' -> activates /c")
    assert(!input.contains("/c"), "'hello /c ' -> /c stripped from input")
}

// ═══════════════════════════════════════════════════════════════════════════════
// processInput — empty input
// ═══════════════════════════════════════════════════════════════════════════════

group("processInput — empty input")

do {
    let (input, active) = CommandProcessor.processInput(
        "", knownCommands: ["/c"], alreadyActive: []
    )
    assertEqual(input, "", "empty input -> empty")
    assertEqual(active, [], "empty input -> no activation")
}

// ═══════════════════════════════════════════════════════════════════════════════
// processInput — multiple known commands
// ═══════════════════════════════════════════════════════════════════════════════

group("processInput — multiple known commands")

do {
    // Only /c is known, /x should be ignored
    let (input, active) = CommandProcessor.processInput(
        "/c /x hello", knownCommands: ["/c", "/x"], alreadyActive: []
    )
    // /c is at start followed by space -> activated
    assert(active.contains("/c"), "activates /c from multiple")
    // After /c is stripped, remaining is "/x hello" — but /x is at start followed by space
    // processInput processes one command at a time, so /x may or may not be processed
    // depending on implementation order
}

// ═══════════════════════════════════════════════════════════════════════════════
// processInput — idempotency (calling again with same input + already active)
// ═══════════════════════════════════════════════════════════════════════════════

group("processInput — idempotency")

do {
    let (input1, active1) = CommandProcessor.processInput(
        "/c hello", knownCommands: ["/c"], alreadyActive: []
    )
    // Call again with already active
    let (input2, active2) = CommandProcessor.processInput(
        input1, knownCommands: ["/c"], alreadyActive: active1
    )
    assertEqual(input2, input1, "idempotent: input unchanged on second call")
    assertEqual(active2, active1, "idempotent: active unchanged on second call")
}

// ═══════════════════════════════════════════════════════════════════════════════
// appendReasoning — rolling window
// ═══════════════════════════════════════════════════════════════════════════════

group("appendReasoning — rolling window")

do {
    let result = CommandProcessor.appendReasoning(
        current: "",
        newText: "line1",
        maxLines: 4
    )
    assertEqual(result, "line1", "single line: kept as-is")
}

do {
    let result = CommandProcessor.appendReasoning(
        current: "line1\nline2",
        newText: "\nline3",
        maxLines: 4
    )
    assertEqual(result, "line1\nline2\nline3", "3 lines: all kept")
}

do {
    let result = CommandProcessor.appendReasoning(
        current: "line1\nline2\nline3\nline4",
        newText: "\nline5",
        maxLines: 4
    )
    assertEqual(result, "line2\nline3\nline4\nline5", "5 lines: oldest dropped")
}

do {
    let result = CommandProcessor.appendReasoning(
        current: "line1\nline2\nline3\nline4",
        newText: "\nline5\nline6\nline7",
        maxLines: 4
    )
    assertEqual(result, "line4\nline5\nline6\nline7", "7 lines: keep last 4")
}

do {
    let result = CommandProcessor.appendReasoning(
        current: "",
        newText: "",
        maxLines: 4
    )
    assertEqual(result, "", "empty + empty -> empty")
}

do {
    let result = CommandProcessor.appendReasoning(
        current: "a\nb\nc\nd",
        newText: "",
        maxLines: 4
    )
    assertEqual(result, "a\nb\nc\nd", "exactly maxLines: unchanged")
}

// ═══════════════════════════════════════════════════════════════════════════════
// buildHistoryEntry
// ═══════════════════════════════════════════════════════════════════════════════

group("buildHistoryEntry")

do {
    let entry = CommandProcessor.buildHistoryEntry(
        rawInput: "hello world",
        activeCommands: []
    )
    assertEqual(entry, "hello world", "no commands -> raw input only")
}

do {
    let entry = CommandProcessor.buildHistoryEntry(
        rawInput: "hello world",
        activeCommands: ["/c"]
    )
    assertEqual(entry, "/c hello world", "one command -> prefixed")
}

do {
    let entry = CommandProcessor.buildHistoryEntry(
        rawInput: "hello",
        activeCommands: ["/c", "/x"]
    )
    assertEqual(entry, "/c /x hello", "two commands -> both prefixed")
}

do {
    let entry = CommandProcessor.buildHistoryEntry(
        rawInput: "",
        activeCommands: ["/c"]
    )
    assertEqual(entry, "/c ", "empty input with command -> command + space")
}

// ═══════════════════════════════════════════════════════════════════════════════
// shouldShowTooltip
// ═══════════════════════════════════════════════════════════════════════════════

group("shouldShowTooltip")

do {
    let show = CommandProcessor.shouldShowTooltip(
        input: "/",
        knownCommands: ["/c"],
        activeCommands: []
    )
    assert(show, "just slash -> show tooltip")
}

do {
    let show = CommandProcessor.shouldShowTooltip(
        input: "/c",
        knownCommands: ["/c"],
        activeCommands: []
    )
    assert(show, "/c partial -> show tooltip")
}

do {
    let show = CommandProcessor.shouldShowTooltip(
        input: "/c ",
        knownCommands: ["/c"],
        activeCommands: []
    )
    assert(!show, "/c with space -> no tooltip (command completed)")
}

do {
    let show = CommandProcessor.shouldShowTooltip(
        input: "hello /",
        knownCommands: ["/c"],
        activeCommands: []
    )
    assert(show, "slash after text -> show tooltip")
}

do {
    let show = CommandProcessor.shouldShowTooltip(
        input: "hello",
        knownCommands: ["/c"],
        activeCommands: []
    )
    assert(!show, "no slash -> no tooltip")
}

do {
    let show = CommandProcessor.shouldShowTooltip(
        input: "/c",
        knownCommands: ["/c"],
        activeCommands: ["/c"]
    )
    assert(!show, "already active -> no tooltip")
}

do {
    let show = CommandProcessor.shouldShowTooltip(
        input: "/x",
        knownCommands: ["/c"],
        activeCommands: []
    )
    assert(!show, "unknown command -> no tooltip")
}

do {
    let show = CommandProcessor.shouldShowTooltip(
        input: "",
        knownCommands: ["/c"],
        activeCommands: []
    )
    assert(!show, "empty input -> no tooltip")
}

// ═══════════════════════════════════════════════════════════════════════════════
// filterCommands
// ═══════════════════════════════════════════════════════════════════════════════

group("filterCommands")

do {
    let cmds = CommandProcessor.filterCommands(
        input: "/",
        knownCommands: ["/c", "/x"],
        activeCommands: []
    )
    assertEqual(cmds.count, 2, "just slash -> all commands")
}

do {
    let cmds = CommandProcessor.filterCommands(
        input: "/c",
        knownCommands: ["/c", "/x"],
        activeCommands: []
    )
    assertEqual(cmds, ["/c"], "/c -> matches /c only")
}

do {
    let cmds = CommandProcessor.filterCommands(
        input: "/",
        knownCommands: ["/c", "/x"],
        activeCommands: ["/c"]
    )
    assertEqual(cmds, ["/x"], "slash with /c active -> only /x")
}

do {
    let cmds = CommandProcessor.filterCommands(
        input: "/c ",
        knownCommands: ["/c"],
        activeCommands: []
    )
    assertEqual(cmds.count, 0, "/c with space -> no results (completed)")
}

do {
    let cmds = CommandProcessor.filterCommands(
        input: "hello",
        knownCommands: ["/c"],
        activeCommands: []
    )
    assertEqual(cmds.count, 0, "no slash -> no results")
}

do {
    let cmds = CommandProcessor.filterCommands(
        input: "/z",
        knownCommands: ["/c", "/x"],
        activeCommands: []
    )
    assertEqual(cmds.count, 0, "/z -> no matches")
}

// ═══════════════════════════════════════════════════════════════════════════════
// ImageContext struct
// ═══════════════════════════════════════════════════════════════════════════════

group("ImageContext")

do {
    let img = ImageContext(base64: "iVBORw0KGgo=", mimeType: "image/png")
    assertEqual(img.base64, "iVBORw0KGgo=", "base64 stored correctly")
    assertEqual(img.mimeType, "image/png", "mimeType stored correctly")
}

do {
    let img = ImageContext(base64: "abc123", mimeType: "image/jpeg")
    assertEqual(img.mimeType, "image/jpeg", "supports jpeg mimeType")
}

// ═══════════════════════════════════════════════════════════════════════════════
// processInput — /c with image context (command activation is same regardless)
// ═══════════════════════════════════════════════════════════════════════════════

group("processInput — /c for image context")

do {
    // /c command activates the same way whether clipboard has text or image
    let (input, active) = CommandProcessor.processInput(
        "/c what is in this image?", knownCommands: ["/c"], alreadyActive: []
    )
    assertEqual(input, "what is in this image?", "/c with image question -> stripped")
    assertEqual(active, ["/c"], "/c activates for image context too")
}

do {
    // Just /c with space (image-only context, no text prompt yet)
    let (input, active) = CommandProcessor.processInput(
        "/c ", knownCommands: ["/c"], alreadyActive: []
    )
    assertEqual(input, "", "/c space only -> empty input")
    assertEqual(active, ["/c"], "/c activated for standalone use")
}

// ═══════════════════════════════════════════════════════════════════════════════
// buildHistoryEntry — with /c (covers text + image scenarios)
// ═══════════════════════════════════════════════════════════════════════════════

group("buildHistoryEntry — with /c")

do {
    let entry = CommandProcessor.buildHistoryEntry(
        rawInput: "describe this image",
        activeCommands: ["/c"]
    )
    assertEqual(entry, "/c describe this image", "image question in history")
}

// ═══════════════════════════════════════════════════════════════════════════════
// shouldShowTooltip — /c tooltip still works with image context
// ═══════════════════════════════════════════════════════════════════════════════

group("shouldShowTooltip — image context scenarios")

do {
    // Tooltip should show when typing / even if clipboard has image
    let show = CommandProcessor.shouldShowTooltip(
        input: "/",
        knownCommands: ["/c"],
        activeCommands: []
    )
    assert(show, "tooltip shows for / (image clipboard)")
}

do {
    // Once /c is active, tooltip should not show it again
    let show = CommandProcessor.shouldShowTooltip(
        input: "/",
        knownCommands: ["/c"],
        activeCommands: ["/c"]
    )
    assert(!show, "no tooltip when /c already active")
}

// ═══════════════════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════════════════

print("\n\(passed) passed, \(failed) failed")
if failed > 0 {
    exit(1)
}
