import Foundation
import Combine

class PanelState: ObservableObject {
    @Published var input: String = ""
    @Published var response: String = ""
    @Published var isLoading: Bool = false
    @Published var showCount: Int = 0

    private var config: GregConfig?
    private var client: LLMClient?

    private let systemPrompt = """
    You are Greg, a helpful assistant. You answer questions clearly and concisely.
    Use markdown formatting when helpful (code blocks, bold, lists).
    Keep responses focused and practical.
    """

    init() {
        reloadConfig()
    }

    func reloadConfig() {
        config = GregConfig.load()
        if let config = config {
            client = try? createLLMClient(config: config)
        }
    }

    func didShow() {
        showCount += 1
        reloadConfig()
    }

    func reset() {
        input = ""
        response = ""
        isLoading = false
    }

    func submit() {
        let prompt = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !prompt.isEmpty else { return }
        guard let client = client else {
            response = "No config found. Run `greg --setup` in terminal to configure."
            return
        }

        input = ""
        response = ""
        isLoading = true

        Task { @MainActor in
            do {
                let result = try await client.generate(
                    systemPrompt: systemPrompt,
                    userPrompt: prompt
                )
                self.response = result
            } catch {
                self.response = "Error: \(error.localizedDescription)"
            }
            self.isLoading = false
        }
    }
}
