import Foundation
import FoundationModels

class AFMClient: LLMClient {
    func stream(
        systemPrompt: String,
        userPrompt: String,
        imageContext: ImageContext?,
        onChunk: @escaping @MainActor (StreamChunk) -> Void
    ) async throws {
        // Note: AFM does not support image context.
        // The caller (PanelState) blocks this case with an error before reaching here.
        let session = LanguageModelSession(instructions: systemPrompt)
        let stream = session.streamResponse(to: userPrompt)

        var lastLength = 0
        for try await partial in stream {
            let text = partial.content
            // FoundationModels returns accumulated text, so extract the delta
            if text.count > lastLength {
                let startIdx = text.index(text.startIndex, offsetBy: lastLength)
                let delta = String(text[startIdx...])
                lastLength = text.count
                await onChunk(.content(delta))
            }
        }

        await onChunk(.done)
    }
}
