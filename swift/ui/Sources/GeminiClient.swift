import Foundation

class GeminiClient: LLMClient {
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
        let url = URL(string: "https://generativelanguage.googleapis.com/v1beta/models/\(model):streamGenerateContent?alt=sse")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(apiKey, forHTTPHeaderField: "x-goog-api-key")

        // Build user parts — text or multimodal (inlineData + text)
        var userParts: [[String: Any]] = []
        if let image = imageContext {
            // Gemini multimodal: inlineData part
            userParts.append([
                "inlineData": [
                    "mimeType": image.mimeType,
                    "data": image.base64
                ]
            ])
        }
        userParts.append(["text": userPrompt])

        let body: [String: Any] = [
            "system_instruction": ["parts": [["text": systemPrompt]]],
            "contents": [
                ["role": "user", "parts": userParts]
            ],
            "generationConfig": [
                "maxOutputTokens": 16384,
                "thinkingConfig": ["thinkingBudget": 8000]
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

            guard let candidates = json["candidates"] as? [[String: Any]],
                  let content = candidates.first?["content"] as? [String: Any],
                  let parts = content["parts"] as? [[String: Any]] else { continue }

            for part in parts {
                guard let text = part["text"] as? String, !text.isEmpty else { continue }

                // Gemini marks thinking parts with "thought": true
                if let thought = part["thought"] as? Bool, thought {
                    await onChunk(.reasoning(text))
                } else {
                    await onChunk(.content(text))
                }
            }
        }

        await onChunk(.done)
    }
}
