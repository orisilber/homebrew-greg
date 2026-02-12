import Cocoa
import ScreenCaptureKit

/// Captures screenshots of specific windows using ScreenCaptureKit.
struct ScreenshotCapture {

    /// Capture a screenshot of the frontmost window belonging to the given process ID.
    /// Uses SCScreenshotManager (macOS 14+) for a clean single-frame capture.
    @available(macOS 14.0, *)
    static func capture(appPID: pid_t) async -> ImageContext? {
        do {
            let content = try await SCShareableContent.excludingDesktopWindows(
                false, onScreenWindowsOnly: true
            )

            // Find the first on-screen window for this PID with a real size
            guard let window = content.windows.first(where: {
                $0.owningApplication?.processID == appPID
                    && $0.frame.width > 0
                    && $0.frame.height > 0
            }) else {
                return nil
            }

            let filter = SCContentFilter(desktopIndependentWindow: window)
            let config = SCStreamConfiguration()
            config.width = Int(window.frame.width)
            config.height = Int(window.frame.height)
            config.captureResolution = .nominal
            config.showsCursor = false

            let cgImage = try await SCScreenshotManager.captureImage(
                contentFilter: filter,
                configuration: config
            )

            let bitmapRep = NSBitmapImageRep(cgImage: cgImage)
            guard let pngData = bitmapRep.representation(using: .png, properties: [:]) else {
                return nil
            }

            return ImageContext(
                base64: pngData.base64EncodedString(),
                mimeType: "image/png"
            )
        } catch {
            return nil
        }
    }
}
