import Foundation
import FoundationModels

class AFMClient: LLMClient {
    func generate(systemPrompt: String, userPrompt: String) async throws -> String {
        let session = LanguageModelSession(instructions: systemPrompt)
        let response = try await session.respond(to: userPrompt)
        return response.content
    }
}
