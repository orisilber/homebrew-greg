import SwiftUI

struct ContentView: View {
    @ObservedObject var state: PanelState
    @FocusState private var isInputFocused: Bool

    @State private var isContextExpanded: Bool = true

    var body: some View {
        VStack(spacing: 0) {
            // Context banner (active context)
            if let ctx = state.context, !ctx.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Button(action: { isContextExpanded.toggle() }) {
                        HStack(spacing: 4) {
                            Image(systemName: isContextExpanded ? "chevron.down" : "chevron.right")
                                .font(.system(size: 10))
                            Text("Context")
                                .font(.system(size: 12, weight: .medium))
                            Spacer()
                            Text("\(ctx.count) chars")
                                .font(.system(size: 10))
                                .foregroundColor(.secondary)
                        }
                        .foregroundColor(.secondary)
                    }
                    .buttonStyle(.plain)

                    if isContextExpanded {
                        Text(ctx)
                            .font(.system(size: 12, design: .monospaced))
                            .foregroundColor(.secondary)
                            .lineLimit(6)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(8)
                            .background(Color.primary.opacity(0.05))
                            .cornerRadius(6)
                    }
                }
                .padding(.horizontal, 12)
                .padding(.top, 8)
                .padding(.bottom, 4)

                Divider()
            } else if let clip = state.clipboardText, !clip.isEmpty {
                // Offer clipboard as context
                HStack(spacing: 6) {
                    Image(systemName: "doc.on.clipboard")
                        .foregroundColor(.secondary)
                        .font(.system(size: 11))
                    Text(clip.prefix(60) + (clip.count > 60 ? "..." : ""))
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                    Spacer()
                    Button("Use as context") {
                        state.useClipboard()
                    }
                    .font(.system(size: 11))
                    .buttonStyle(.plain)
                    .foregroundColor(.accentColor)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 6)

                Divider()
            }

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
        .onChange(of: state.isLoading) {
            if !state.isLoading {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                    isInputFocused = true
                }
            }
        }
    }
}
