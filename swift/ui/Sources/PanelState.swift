import Foundation
import Combine

class PanelState: ObservableObject {
    @Published var input: String = ""
    @Published var response: String = ""
    @Published var reasoning: String = ""
    @Published var isLoading: Bool = false
    @Published var isReasoning: Bool = false
    @Published var errorMessage: String? = nil
    @Published var showCount: Int = 0
    @Published var context: String? = nil
    @Published var clipboardText: String? = nil
    @Published var activeCommands: [String] = []  // e.g. ["/c"]

    private var config: GregConfig?
    private var client: LLMClient?

    private let systemPrompt = """
    You are Greg, a helpful assistant. You answer questions clearly and concisely.
    Respond in PLAIN TEXT only. No markdown, no code fences, no bold, no headers, no bullet symbols like * or -.
    Use simple indentation and newlines for structure. For code, just write it plainly without backtick fences.
    Keep responses focused and practical.
    """

    /// Max lines of reasoning to display (rolling window).
    private let maxReasoningLines = 4

    /// Prompt history (persists across panel shows within a session).
    private(set) var history: [String] = []
    private var historyIndex: Int = -1

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
        reasoning = ""
        isLoading = false
        isReasoning = false
        errorMessage = nil
        context = nil
        clipboardText = nil
        activeCommands = []
    }

    /// Use clipboard text as context.
    func useClipboard() {
        context = clipboardText
        clipboardText = nil
    }

    /// Called when input changes. Detects a completed slash command (command + space)
    /// and activates it: strips the command from input and adds a chip.
    func processInputForCommands(_ knownCommands: [String]) {
        let (newInput, newActive) = CommandProcessor.processInput(
            input,
            knownCommands: knownCommands,
            alreadyActive: activeCommands
        )
        if newActive.count > activeCommands.count {
            input = newInput
            activeCommands = newActive
        }
    }

    /// Navigate history backwards (up arrow).
    func historyBack() {
        guard !history.isEmpty else { return }
        if historyIndex < 0 {
            historyIndex = history.count - 1
        } else if historyIndex > 0 {
            historyIndex -= 1
        }
        input = history[historyIndex]
    }

    /// Navigate history forwards (down arrow).
    func historyForward() {
        guard historyIndex >= 0 else { return }
        if historyIndex < history.count - 1 {
            historyIndex += 1
            input = history[historyIndex]
        } else {
            historyIndex = -1
            input = ""
        }
    }

    func submit() {
        let rawInput = input.trimmingCharacters(in: .whitespacesAndNewlines)
        let prompt = rawInput
        guard !prompt.isEmpty else { return }
        guard let client = client else {
            errorMessage = "No config found. Run `greg --setup` in terminal to configure."
            return
        }

        // Process active slash commands
        if activeCommands.contains("/c") {
            if let clip = ClipboardReader.text() {
                context = clip
            }
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

        // Save to history: reconstruct with commands so recall shows them
        let historyEntry = CommandProcessor.buildHistoryEntry(
            rawInput: rawInput,
            activeCommands: activeCommands
        )
        history.append(historyEntry)
        historyIndex = -1

        input = ""
        response = ""
        reasoning = ""
        isLoading = true
        isReasoning = false

        Task { @MainActor in
            do {
                try await client.stream(
                    systemPrompt: systemPrompt,
                    userPrompt: userPrompt
                ) { [weak self] chunk in
                    guard let self = self else { return }
                    switch chunk {
                    case .reasoning(let text):
                        self.isReasoning = true
                        self.appendReasoning(text)
                    case .content(let text):
                        self.isReasoning = false
                        self.response += text
                    case .done:
                        self.isLoading = false
                        self.isReasoning = false
                    case .error(let message):
                        self.errorMessage = message
                        self.isLoading = false
                        self.isReasoning = false
                    }
                }
            } catch {
                self.errorMessage = error.localizedDescription
                self.isLoading = false
                self.isReasoning = false
            }
        }
    }

    /// Append reasoning text, keeping only the last N lines visible.
    private func appendReasoning(_ text: String) {
        reasoning = CommandProcessor.appendReasoning(
            current: reasoning,
            newText: text,
            maxLines: maxReasoningLines
        )
    }
}
