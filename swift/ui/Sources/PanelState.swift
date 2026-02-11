import Foundation
import Combine

class PanelState: ObservableObject {
    @Published var input: String = ""
    @Published var response: String = ""
    @Published var isLoading: Bool = false
    @Published var showCount: Int = 0
    @Published var context: String? = nil
    @Published var clipboardText: String? = nil

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
        context = nil
        clipboardText = nil
    }

    /// Use clipboard text as context.
    func useClipboard() {
        context = clipboardText
        clipboardText = nil
    }

    func submit() {
        var prompt = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !prompt.isEmpty else { return }
        guard let client = client else {
            response = "No config found. Run `greg --setup` in terminal to configure."
            return
        }

        // /c prefix: pull clipboard into context
        if prompt.hasPrefix("/c ") || prompt.hasPrefix("/c\n") {
            prompt = String(prompt.dropFirst(3)).trimmingCharacters(in: .whitespacesAndNewlines)
            if let clip = ClipboardReader.text() {
                context = clip
            }
            guard !prompt.isEmpty else { return }
        }

        // Build the user prompt, injecting context if present
        var userPrompt = prompt
        if let context = context, !context.isEmpty {
            userPrompt = """
            The user provided the following context:

            ```
            \(context)
            ```

            User's question: \(prompt)
            """
        }

        input = ""
        response = ""
        isLoading = true

        Task { @MainActor in
            do {
                let result = try await client.generate(
                    systemPrompt: systemPrompt,
                    userPrompt: userPrompt
                )
                self.response = result
            } catch {
                self.response = "Error: \(error.localizedDescription)"
            }
            self.isLoading = false
        }
    }
}
