import Cocoa

/// Reads clipboard content for use as LLM context.
struct ClipboardReader {

    /// Read the current clipboard text (if any).
    static func text() -> String? {
        guard let text = NSPasteboard.general.string(forType: .string) else {
            return nil
        }
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
