import Foundation

class OpenAIClient: LLMClient {
    private let apiKey: String
    private let model: String

    init(apiKey: String, model: String) {
        self.apiKey = apiKey
        self.model = model
    }

    func stream(
        systemPrompt: String,
        userPrompt: String,
        imageContext: ImageContext?,
        onChunk: @escaping @MainActor (StreamChunk) -> Void
    ) async throws {
        let url = URL(string: "https://api.openai.com/v1/chat/completions")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        // Build user message content — text or multimodal (image_url + text)
        var userContent: Any
        if let image = imageContext {
            // OpenAI multimodal: array of content parts
            userContent = [
                [
                    "type": "image_url",
                    "image_url": [
                        "url": "data:\(image.mimeType);base64,\(image.base64)"
                    ]
                ] as [String: Any],
                [
                    "type": "text",
                    "text": userPrompt
                ] as [String: Any]
            ]
        } else {
            userContent = userPrompt
        }

        let body: [String: Any] = [
            "model": model,
            "max_tokens": 16384,
            "stream": true,
            "messages": [
                ["role": "system", "content": systemPrompt],
                ["role": "user", "content": userContent]
            ]
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (bytes, response) = try await URLSession.shared.bytes(for: request)

        if let httpResponse = response as? HTTPURLResponse,
           httpResponse.statusCode != 200 {
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

            guard let choices = json["choices"] as? [[String: Any]],
                  let delta = choices.first?["delta"] as? [String: Any] else { continue }

            // Reasoning tokens (o1/o3 models)
            if let reasoning = delta["reasoning_content"] as? String, !reasoning.isEmpty {
                await onChunk(.reasoning(reasoning))
            }

            // Content tokens
            if let content = delta["content"] as? String, !content.isEmpty {
                await onChunk(.content(content))
            }

            // Check for finish
            if let finishReason = choices.first?["finish_reason"] as? String,
               !finishReason.isEmpty {
                await onChunk(.done)
            }
        }

        await onChunk(.done)
    }
}
