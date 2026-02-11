import Foundation

protocol LLMClient {
    func generate(systemPrompt: String, userPrompt: String) async throws -> String
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
