import Cocoa
import SwiftUI

class FloatingPanel: NSPanel {
    var onHide: (() -> Void)?

    init(state: PanelState) {
        super.init(
            contentRect: NSRect(x: 0, y: 0, width: 600, height: 400),
            styleMask: [.nonactivatingPanel],
            backing: .buffered,
            defer: false
        )

        // Floating behavior
        self.level = .floating
        self.isFloatingPanel = true
        self.hidesOnDeactivate = false
        self.becomesKeyOnlyIfNeeded = false
        self.isMovableByWindowBackground = false
        self.isOpaque = false
        self.backgroundColor = .clear
        self.hasShadow = true

        // Blur background
        let visualEffect = NSVisualEffectView()
        visualEffect.material = .hudWindow
        visualEffect.blendingMode = .behindWindow
        visualEffect.state = .active
        visualEffect.wantsLayer = true
        visualEffect.layer?.cornerRadius = 12
        visualEffect.layer?.masksToBounds = true

        // SwiftUI content
        let hostingView = NSHostingView(rootView: ContentView(state: state))
        hostingView.translatesAutoresizingMaskIntoConstraints = false

        visualEffect.addSubview(hostingView)
        NSLayoutConstraint.activate([
            hostingView.topAnchor.constraint(equalTo: visualEffect.topAnchor),
            hostingView.bottomAnchor.constraint(equalTo: visualEffect.bottomAnchor),
            hostingView.leadingAnchor.constraint(equalTo: visualEffect.leadingAnchor),
            hostingView.trailingAnchor.constraint(equalTo: visualEffect.trailingAnchor),
        ])

        self.contentView = visualEffect
    }

    override var canBecomeKey: Bool { true }

    override func cancelOperation(_ sender: Any?) {
        hide()
    }

    override func keyDown(with event: NSEvent) {
        if event.keyCode == 53 { // Esc
            hide()
        } else {
            super.keyDown(with: event)
        }
    }

    func hide() {
        orderOut(nil)
        onHide?()
    }

    func centerOnScreen() {
        guard let screen = NSScreen.main else { return }
        let screenFrame = screen.visibleFrame
        let size = frame.size
        let x = screenFrame.origin.x + (screenFrame.width - size.width) / 2
        let y = screenFrame.origin.y + (screenFrame.height - size.height) / 2 + screenFrame.height * 0.1
        setFrameOrigin(NSPoint(x: x, y: y))
    }
}
