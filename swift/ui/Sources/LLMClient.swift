import Foundation

/// A chunk of streamed LLM output.
enum StreamChunk {
    case reasoning(String)   // thinking/reasoning token
    case content(String)     // response content token
    case done                // stream finished
    case error(String)       // error occurred
}

protocol LLMClient {
    /// Stream a response, calling the handler for each chunk on the main thread.
    func stream(
        systemPrompt: String,
        userPrompt: String,
        onChunk: @escaping @MainActor (StreamChunk) -> Void
    ) async throws
}

enum LLMError: LocalizedError {
    case noConfig
    case noApiKey
    case apiError(String)
    case unknown

    var errorDescription: String? {
        switch self {
        case .noConfig: return "No config found. Run `greg --setup` to configure."
        case .noApiKey: return "No API key configured. Run `greg --setup` to configure."
        case .apiError(let msg): return msg
        case .unknown: return "Unknown error"
        }
    }
}

func createLLMClient(config: GregConfig) throws -> LLMClient {
    switch config.provider {
    case "anthropic":
        guard let key = config.apiKey, !key.isEmpty else { throw LLMError.noApiKey }
        return AnthropicClient(apiKey: key, model: config.model ?? "claude-sonnet-4-20250514")
    case "openai":
        guard let key = config.apiKey, !key.isEmpty else { throw LLMError.noApiKey }
        return OpenAIClient(apiKey: key, model: config.model ?? "gpt-4o-mini")
    case "gemini":
        guard let key = config.apiKey, !key.isEmpty else { throw LLMError.noApiKey }
        return GeminiClient(apiKey: key, model: config.model ?? "gemini-2.5-flash")
    case "afm":
        return AFMClient()
    default:
        throw LLMError.apiError("Unknown provider: \(config.provider)")
    }
}

// MARK: - SSE Parsing Helpers

/// Parse lines from an SSE stream. Handles "data: {json}" format.
func parseSSELine(_ line: String) -> [String: Any]? {
    let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
    guard trimmed.hasPrefix("data: ") else { return nil }
    let jsonStr = String(trimmed.dropFirst(6))
    guard jsonStr != "[DONE]" else { return nil }
    guard let data = jsonStr.data(using: .utf8),
          let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
        return nil
    }
    return json
}
