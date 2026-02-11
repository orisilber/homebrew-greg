import SwiftUI

struct ContentView: View {
    @ObservedObject var state: PanelState
    @FocusState private var isInputFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            // Response area
            ScrollViewReader { proxy in
                ScrollView {
                    if state.response.isEmpty && !state.isLoading {
                        Text("Ask Greg anything...")
                            .foregroundColor(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding()
                    } else {
                        VStack(alignment: .leading, spacing: 8) {
                            if state.isLoading && state.response.isEmpty {
                                HStack(spacing: 6) {
                                    ProgressView()
                                        .controlSize(.small)
                                    Text("Thinking...")
                                        .foregroundColor(.secondary)
                                }
                                .padding()
                            }

                            if !state.response.isEmpty {
                                Text(state.response)
                                    .font(.system(.body, design: .monospaced))
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding()
                                    .textSelection(.enabled)
                            }
                        }
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
            HStack {
                TextField("Ask Greg...", text: $state.input)
                    .textFieldStyle(.plain)
                    .font(.system(size: 16))
                    .focused($isInputFocused)
                    .disabled(state.isLoading)
                    .onSubmit {
                        state.submit()
                    }

                if state.isLoading {
                    ProgressView()
                        .controlSize(.small)
                }
            }
            .padding(12)
        }
        .frame(width: 600, height: 400)
        .onChange(of: state.showCount) {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                isInputFocused = true
            }
        }
    }
}
