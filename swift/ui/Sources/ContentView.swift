import SwiftUI

struct ContentView: View {
    @ObservedObject var state: PanelState
    @FocusState private var isInputFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            // Response area
            ScrollViewReader { proxy in
                ScrollView {
                    if state.response.isEmpty {
                        Text("Ask Greg anything...")
                            .foregroundColor(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding()
                    } else {
                        Text(state.response)
                            .font(.system(.body, design: .monospaced))
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding()
                            .textSelection(.enabled)
                            .id("response")
                    }
                }
                .onChange(of: state.response) {
                    proxy.scrollTo("response", anchor: .bottom)
                }
            }
            .frame(maxHeight: .infinity)

            Divider()

            // Input area
            TextField("Ask Greg...", text: $state.input)
                .textFieldStyle(.plain)
                .font(.system(size: 16))
                .padding(12)
                .focused($isInputFocused)
                .onSubmit {
                    submitPrompt()
                }
        }
        .frame(width: 600, height: 400)
        .onChange(of: state.showCount) {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                isInputFocused = true
            }
        }
    }

    private func submitPrompt() {
        let prompt = state.input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !prompt.isEmpty else { return }

        state.input = ""
        state.response = "Thinking..."

        // TODO: Phase 2 — call LLM
        state.response = "LLM integration coming in Phase 2.\n\nYou asked: \(prompt)"
    }
}
