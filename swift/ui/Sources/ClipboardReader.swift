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

    /// Read the current clipboard image as base64-encoded PNG data.
    /// Supports .png and .tiff pasteboard types (screenshots, copied images).
    static func image() -> ImageContext? {
        let pasteboard = NSPasteboard.general

        // Try PNG first (most common for screenshots)
        if let pngData = pasteboard.data(forType: .png) {
            return ImageContext(
                base64: pngData.base64EncodedString(),
                mimeType: "image/png"
            )
        }

        // Try TIFF (common for images copied from macOS apps)
        if let tiffData = pasteboard.data(forType: .tiff),
           let bitmapRep = NSBitmapImageRep(data: tiffData),
           let pngData = bitmapRep.representation(using: .png, properties: [:]) {
            return ImageContext(
                base64: pngData.base64EncodedString(),
                mimeType: "image/png"
            )
        }

        return nil
    }

    /// Check if the clipboard contains an image.
    static func hasImage() -> Bool {
        let pasteboard = NSPasteboard.general
        return pasteboard.data(forType: .png) != nil
            || pasteboard.data(forType: .tiff) != nil
    }
}
