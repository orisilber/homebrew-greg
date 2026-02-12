import SwiftUI

struct SlashCommand {
    let command: String
    let name: String
    let description: String
}

let slashCommands: [SlashCommand] = [
    SlashCommand(command: "/c", name: "clipboard", description: "Attach clipboard as context"),
    SlashCommand(command: "/s", name: "screenshot", description: "Screenshot the last app window"),
]

struct ContentView: View {
    @ObservedObject var state: PanelState
    @FocusState private var isInputFocused: Bool

    @State private var isContextExpanded: Bool = true

    /// Show the tooltip when the user is typing a partial slash command.
    private var showSlashCommands: Bool {
        CommandProcessor.shouldShowTooltip(
            input: state.input,
            knownCommands: slashCommands.map { $0.command },
            activeCommands: state.activeCommands
        )
    }

    private var filteredCommands: [SlashCommand] {
        let matching = CommandProcessor.filterCommands(
            input: state.input,
            knownCommands: slashCommands.map { $0.command },
            activeCommands: state.activeCommands
        )
        return slashCommands.filter { matching.contains($0.command) }
    }

    /// Whether there's active context (text or image) to display.
    private var hasActiveContext: Bool {
        (state.context != nil && !state.context!.isEmpty) || state.imageContext != nil
    }

    /// Whether there's a clipboard offer (text or image) to show.
    private var hasClipboardOffer: Bool {
        guard !hasActiveContext else { return false }
        return (state.clipboardText != nil && !state.clipboardText!.isEmpty) || state.clipboardHasImage
    }

    /// Resolve active command strings to SlashCommand objects for display.
    private var activeCommandObjects: [SlashCommand] {
        state.activeCommands.compactMap { cmd in
            slashCommands.first { $0.command == cmd }
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Context banner (active context — text and/or image)
            if hasActiveContext {
                VStack(alignment: .leading, spacing: 4) {
                    Button(action: { isContextExpanded.toggle() }) {
                        HStack(spacing: 4) {
                            Image(systemName: isContextExpanded ? "chevron.down" : "chevron.right")
                                .font(.system(size: 10))
                            Text("Context")
                                .font(.system(size: 12, weight: .medium))
                            Spacer()
                            if let ctx = state.context, !ctx.isEmpty {
                                Text("\(ctx.count) chars")
                                    .font(.system(size: 10))
                                    .foregroundColor(.secondary)
                            }
                            if state.imageContext != nil {
                                Image(systemName: "photo")
                                    .font(.system(size: 10))
                                    .foregroundColor(.secondary)
                            }
                        }
                        .foregroundColor(.secondary)
                    }
                    .buttonStyle(.plain)

                    if isContextExpanded {
                        // Image thumbnail
                        if let img = state.imageContext,
                           let data = Data(base64Encoded: img.base64),
                           let nsImage = NSImage(data: data) {
                            Image(nsImage: nsImage)
                                .resizable()
                                .aspectRatio(contentMode: .fit)
                                .frame(maxHeight: 100)
                                .cornerRadius(6)
                                .padding(4)
                        }

                        // Text context
                        if let ctx = state.context, !ctx.isEmpty {
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
                }
                .padding(.horizontal, 12)
                .padding(.top, 8)
                .padding(.bottom, 4)

                Divider()
            } else if hasClipboardOffer {
                // Offer clipboard as context (text and/or image)
                HStack(spacing: 6) {
                    Image(systemName: state.clipboardHasImage ? "photo.on.rectangle" : "doc.on.clipboard")
                        .foregroundColor(.secondary)
                        .font(.system(size: 11))
                    if let clip = state.clipboardText, !clip.isEmpty {
                        Text(clip.prefix(60) + (clip.count > 60 ? "..." : ""))
                            .font(.system(size: 11))
                            .foregroundColor(.secondary)
                            .lineLimit(1)
                    } else if state.clipboardHasImage {
                        Text("Image on clipboard")
                            .font(.system(size: 11))
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                    Button("Use as context /c") {
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
                    // Error state
                    if let error = state.errorMessage {
                        HStack(alignment: .top, spacing: 8) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundColor(.red)
                                .font(.system(size: 14))
                            Text(error)
                                .font(.system(size: 13))
                                .foregroundColor(.red.opacity(0.9))
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .padding()
                    } else if state.response.isEmpty && state.reasoning.isEmpty && !state.isLoading {
                        Text("Ask Greg anything...")
                            .foregroundColor(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding()
                    } else {
                        VStack(alignment: .leading, spacing: 4) {
                            // Reasoning block (dimmed, rolling 4 lines)
                            if !state.reasoning.isEmpty {
                                VStack(alignment: .leading, spacing: 2) {
                                    HStack(spacing: 4) {
                                        if state.isReasoning {
                                            ProgressView()
                                                .controlSize(.mini)
                                        }
                                        Text("Thinking...")
                                            .font(.system(size: 11, weight: .medium))
                                            .foregroundColor(.orange.opacity(0.8))
                                    }

                                    Text(state.reasoning)
                                        .font(.system(size: 11, design: .monospaced))
                                        .foregroundColor(.primary.opacity(0.35))
                                        .lineLimit(4)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                }
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(Color.primary.opacity(0.03))
                                .cornerRadius(6)
                                .padding(.horizontal, 8)
                                .padding(.top, 8)
                            }

                            // Loading spinner (before any content arrives)
                            if state.isLoading && state.response.isEmpty && state.reasoning.isEmpty {
                                HStack(spacing: 6) {
                                    ProgressView()
                                        .controlSize(.small)
                                    Text("Connecting...")
                                        .foregroundColor(.secondary)
                                }
                                .padding()
                            }

                            // Response text (primary color)
                            if !state.response.isEmpty {
                                Text(state.response)
                                    .font(.system(.body, design: .monospaced))
                                    .foregroundColor(.primary)
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
                .onChange(of: state.reasoning) {
                    if state.response.isEmpty {
                        proxy.scrollTo("response", anchor: .bottom)
                    }
                }
            }
            .frame(maxHeight: .infinity)

            Divider()

            // Slash command tooltip
            if showSlashCommands {
                VStack(alignment: .leading, spacing: 2) {
                    ForEach(filteredCommands, id: \.command) { cmd in
                        HStack(spacing: 6) {
                            Text(cmd.command)
                                .font(.system(size: 12, weight: .semibold, design: .monospaced))
                                .foregroundColor(.accentColor)
                            Text(cmd.name)
                                .font(.system(size: 12, weight: .medium))
                                .foregroundColor(.primary.opacity(0.7))
                            Text("— \(cmd.description)")
                                .font(.system(size: 12))
                                .foregroundColor(.secondary)
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                    }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Color.primary.opacity(0.05))
            }

            // Input area
            HStack(spacing: 6) {
                // Colored slash command chips (click to remove)
                ForEach(activeCommandObjects, id: \.command) { cmd in
                    Button(action: { state.removeCommand(cmd.command) }) {
                        HStack(spacing: 3) {
                            Text(cmd.name)
                                .font(.system(size: 12, weight: .semibold))
                            Image(systemName: "xmark")
                                .font(.system(size: 8, weight: .bold))
                        }
                        .foregroundColor(.white)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.accentColor)
                        .cornerRadius(4)
                    }
                    .buttonStyle(.plain)
                }

                TextField("Ask Greg...", text: $state.input)
                    .textFieldStyle(.plain)
                    .font(.system(size: 16))
                    .focused($isInputFocused)
                    .disabled(state.isLoading)
                    .onSubmit {
                        state.submit()
                    }
                    .onKeyPress(.upArrow) {
                        state.historyBack()
                        return .handled
                    }
                    .onKeyPress(.downArrow) {
                        state.historyForward()
                        return .handled
                    }
                    .onKeyPress(.delete) {
                        if state.input.isEmpty && !state.activeCommands.isEmpty {
                            state.removeLastCommand()
                            return .handled
                        }
                        return .ignored
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
        .onChange(of: state.input) {
            state.processInputForCommands(slashCommands.map { $0.command })
        }
    }
}
