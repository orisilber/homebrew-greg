import Foundation

/// Pure logic for slash command detection, stripping, reasoning window, and history.
/// Extracted from PanelState for testability.
struct CommandProcessor {

    // MARK: - Command detection

    /// Check if text contains a slash command as a whole word.
    static func containsCommand(_ text: String, _ cmd: String) -> Bool {
        if text == cmd { return true }
        if text.hasPrefix(cmd + " ") || text.hasPrefix(cmd + "\n") { return true }
        if text.contains(" " + cmd + " ") || text.contains(" " + cmd + "\n") { return true }
        if text.hasSuffix(" " + cmd) { return true }
        return false
    }

    /// Strip a slash command from the input text.
    static func stripCommand(_ text: String, _ cmd: String) -> String {
        var result = text
        result = result.replacingOccurrences(of: cmd + " ", with: "")
        result = result.replacingOccurrences(of: " " + cmd, with: "")
        result = result.replacingOccurrences(of: cmd, with: "")
        return result.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Process input for completed slash commands (command + space).
    /// Returns (newInput, activatedCommands).
    static func processInput(
        _ input: String,
        knownCommands: [String],
        alreadyActive: [String]
    ) -> (String, [String]) {
        var currentInput = input
        var activated = alreadyActive

        for cmd in knownCommands {
            guard !activated.contains(cmd) else { continue }

            // Check for command followed by space anywhere in input
            if currentInput == cmd + " " {
                currentInput = ""
                activated.append(cmd)
            } else if currentInput.hasPrefix(cmd + " ") {
                currentInput = String(currentInput.dropFirst(cmd.count + 1))
                activated.append(cmd)
            } else if currentInput.contains(" " + cmd + " ") {
                currentInput = currentInput.replacingOccurrences(of: " " + cmd + " ", with: " ")
                activated.append(cmd)
            } else if currentInput.hasSuffix(" " + cmd + " ") {
                currentInput = String(currentInput.dropLast(cmd.count + 1)).trimmingCharacters(in: .whitespaces)
                activated.append(cmd)
            }
        }

        return (currentInput.trimmingCharacters(in: .whitespaces), activated)
    }

    // MARK: - Reasoning window

    /// Append reasoning text and trim to the last `maxLines` lines.
    /// Returns the new reasoning string.
    static func appendReasoning(
        current: String,
        newText: String,
        maxLines: Int
    ) -> String {
        let combined = current + newText
        let lines = combined.components(separatedBy: "\n")
        if lines.count > maxLines {
            return lines.suffix(maxLines).joined(separator: "\n")
        }
        return combined
    }

    // MARK: - History entry

    /// Build a history entry from active commands and raw input.
    static func buildHistoryEntry(
        rawInput: String,
        activeCommands: [String]
    ) -> String {
        let commandPrefix = activeCommands.joined(separator: " ")
        return commandPrefix.isEmpty ? rawInput : commandPrefix + " " + rawInput
    }

    // MARK: - Tooltip logic

    /// Determine if the slash command tooltip should be shown.
    static func shouldShowTooltip(
        input: String,
        knownCommands: [String],
        activeCommands: [String]
    ) -> Bool {
        guard let lastSlash = input.range(of: "/", options: .backwards) else { return false }
        let partial = String(input[lastSlash.lowerBound...])
        if partial.contains(" ") { return false }
        // For bare "/", show tooltip only if there are available (non-active) commands
        if partial == "/" {
            return knownCommands.contains { !activeCommands.contains($0) }
        }
        return knownCommands.contains { cmd in
            cmd.hasPrefix(partial) && !activeCommands.contains(cmd)
        }
    }

    /// Filter commands matching the current partial input.
    static func filterCommands(
        input: String,
        knownCommands: [String],
        activeCommands: [String]
    ) -> [String] {
        guard let lastSlash = input.range(of: "/", options: .backwards) else { return [] }
        let partial = String(input[lastSlash.lowerBound...])
        if partial.contains(" ") { return [] }
        if partial == "/" {
            return knownCommands.filter { !activeCommands.contains($0) }
        }
        return knownCommands.filter {
            $0.hasPrefix(partial) && !activeCommands.contains($0)
        }
    }
}
