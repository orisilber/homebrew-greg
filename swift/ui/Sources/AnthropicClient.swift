import Foundation

class AnthropicClient: LLMClient {
    private let apiKey: String
    private let model: String

    init(apiKey: String, model: String) {
        self.apiKey = apiKey
        self.model = model
    }

    func stream(
        systemPrompt: String,
        userPrompt: String,
        onChunk: @escaping @MainActor (StreamChunk) -> Void
    ) async throws {
        let url = URL(string: "https://api.anthropic.com/v1/messages")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        request.setValue("application/json", forHTTPHeaderField: "content-type")

        var body: [String: Any] = [
            "model": model,
            "max_tokens": 16384,
            "stream": true,
            "system": systemPrompt,
            "messages": [
                ["role": "user", "content": userPrompt]
            ]
        ]

        // Enable extended thinking for Claude models that support it
        if model.contains("claude") {
            body["thinking"] = [
                "type": "enabled",
                "budget_tokens": 10000
            ]
        }

        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (bytes, response) = try await URLSession.shared.bytes(for: request)

        if let httpResponse = response as? HTTPURLResponse,
           httpResponse.statusCode != 200 {
            // Read the error body
            var errorBody = ""
            for try await line in bytes.lines {
                errorBody += line
            }
            if let data = errorBody.data(using: .utf8),
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let error = json["error"] as? [String: Any],
               let message = error["message"] as? String {
                throw LLMError.apiError(message)
            }
            throw LLMError.apiError("HTTP \(httpResponse.statusCode)")
        }

        for try await line in bytes.lines {
            guard let json = parseSSELine(line) else { continue }
            guard let type = json["type"] as? String else { continue }

            switch type {
            case "content_block_delta":
                guard let delta = json["delta"] as? [String: Any],
                      let deltaType = delta["type"] as? String else { continue }

                switch deltaType {
                case "thinking_delta":
                    if let thinking = delta["thinking"] as? String {
                        await onChunk(.reasoning(thinking))
                    }
                case "text_delta":
                    if let text = delta["text"] as? String {
                        await onChunk(.content(text))
                    }
                default:
                    break
                }

            case "message_stop":
                await onChunk(.done)

            case "error":
                if let error = json["error"] as? [String: Any],
                   let message = error["message"] as? String {
                    await onChunk(.error(message))
                }

            default:
                break
            }
        }

        await onChunk(.done)
    }
}
