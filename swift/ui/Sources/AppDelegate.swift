import Cocoa

class AppDelegate: NSObject, NSApplicationDelegate {
    private var panel: FloatingPanel!
    private var panelState: PanelState!
    private var hotkeyManager: HotkeyManager!
    private var statusItem: NSStatusItem!
    private var clickMonitor: Any?
    private var appActivationObserver: Any?

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Menu bar app — no dock icon
        NSApp.setActivationPolicy(.accessory)

        // Shared state
        panelState = PanelState()

        // Floating panel
        panel = FloatingPanel(state: panelState)
        panel.onHide = { [weak self] in
            self?.removeMonitors()
        }

        // Global hotkey (Ctrl+Shift+Space)
        hotkeyManager = HotkeyManager { [weak self] in
            self?.togglePanel()
        }
        hotkeyManager.register()

        // Menu bar icon
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        if let button = statusItem.button {
            button.image = NSImage(
                systemSymbolName: "terminal",
                accessibilityDescription: "Greg"
            )
        }
        let menu = NSMenu()
        menu.addItem(NSMenuItem(
            title: "Quit Greg",
            action: #selector(NSApplication.terminate(_:)),
            keyEquivalent: "q"
        ))
        statusItem.menu = menu
    }

    // MARK: - Panel lifecycle

    private func togglePanel() {
        if panel.isVisible {
            panel.hide()
        } else {
            showPanel()
        }
    }

    private func showPanel() {
        panelState.reset()

        // Offer clipboard content as context if available
        panelState.clipboardText = ClipboardReader.text()
        panelState.clipboardHasImage = ClipboardReader.hasImage()

        panel.centerOnScreen()
        panel.show()
        panelState.didShow()

        // Dismiss on click outside
        clickMonitor = NSEvent.addGlobalMonitorForEvents(
            matching: [.leftMouseDown, .rightMouseDown]
        ) { [weak self] _ in
            self?.panel.hide()
        }

        // Dismiss when another app activates (Cmd+Tab, clicking another window, etc.)
        appActivationObserver = NSWorkspace.shared.notificationCenter.addObserver(
            forName: NSWorkspace.didActivateApplicationNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.panel.hide()
        }
    }

    private func removeMonitors() {
        if let monitor = clickMonitor {
            NSEvent.removeMonitor(monitor)
            clickMonitor = nil
        }
        if let observer = appActivationObserver {
            NSWorkspace.shared.notificationCenter.removeObserver(observer)
            appActivationObserver = nil
        }
    }
}
