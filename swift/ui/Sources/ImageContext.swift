import Foundation

/// Image data for multimodal context.
struct ImageContext {
    let base64: String       // base64-encoded PNG data
    let mimeType: String     // e.g. "image/png"
}
