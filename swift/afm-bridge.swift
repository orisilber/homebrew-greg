import Foundation
import FoundationModels
import Darwin

struct Input: Codable {
    let systemPrompt: String
    let userPrompt: String
}

// ── Availability check mode ────────────────────────────────────────────────

if CommandLine.arguments.contains("--check") {
    let model = SystemLanguageModel.default
    switch model.availability {
    case .available:
        print("available")
    case .unavailable(.deviceNotEligible):
        print("unavailable:deviceNotEligible")
    case .unavailable(.appleIntelligenceNotEnabled):
        print("unavailable:appleIntelligenceNotEnabled")
    case .unavailable(.modelNotReady):
        print("unavailable:modelNotReady")
    case .unavailable(_):
        print("unavailable:unknown")
    }
    exit(0)
}

// ── Generation mode ────────────────────────────────────────────────────────

let inputData = FileHandle.standardInput.readDataToEndOfFile()

guard let input = try? JSONDecoder().decode(Input.self, from: inputData) else {
    FileHandle.standardError.write("Error: Invalid JSON input\n".data(using: .utf8)!)
    exit(1)
}

Task {
    do {
        let session = LanguageModelSession(instructions: input.systemPrompt)
        if CommandLine.arguments.contains("--stream") {
            var previous = ""
            for try await partial in session.streamResponse(to: input.userPrompt) {
                let text = partial.content
                guard text.hasPrefix(previous) else {
                    throw NSError(domain: "Greg", code: 1, userInfo: [NSLocalizedDescriptionKey: "Model revised an already streamed command."])
                }
                print(String(text.dropFirst(previous.count)), terminator: "")
                fflush(stdout)
                previous = text
            }
        } else {
            let response = try await session.respond(to: input.userPrompt)
            print(response.content)
        }
    } catch {
        FileHandle.standardError.write("Error: \(error.localizedDescription)\n".data(using: .utf8)!)
        exit(1)
    }
    exit(0)
}

RunLoop.main.run()
