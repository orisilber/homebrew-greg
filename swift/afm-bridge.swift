import Foundation
import FoundationModels

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
        let response = try await session.respond(to: input.userPrompt)
        print(response.content)
    } catch {
        FileHandle.standardError.write("Error: \(error.localizedDescription)\n".data(using: .utf8)!)
        exit(1)
    }
    exit(0)
}

RunLoop.main.run()
