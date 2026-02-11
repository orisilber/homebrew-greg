import Carbon
import Cocoa

class HotkeyManager {
    private var hotKeyRef: EventHotKeyRef?
    private static var instance: HotkeyManager?

    private let callback: () -> Void

    init(callback: @escaping () -> Void) {
        self.callback = callback
        HotkeyManager.instance = self
    }

    func register() {
        // Ctrl + Shift + Space
        let modifiers: UInt32 = UInt32(controlKey | shiftKey)
        let keyCode: UInt32 = 49 // Space

        var hotKeyID = EventHotKeyID()
        hotKeyID.signature = OSType(0x47524547) // "GREG"
        hotKeyID.id = 1

        var eventType = EventTypeSpec(
            eventClass: OSType(kEventClassKeyboard),
            eventKind: OSType(kEventHotKeyPressed)
        )

        InstallEventHandler(
            GetApplicationEventTarget(),
            hotkeyCallback,
            1,
            &eventType,
            nil,
            nil
        )

        RegisterEventHotKey(
            keyCode,
            modifiers,
            hotKeyID,
            GetApplicationEventTarget(),
            0,
            &hotKeyRef
        )
    }

    func unregister() {
        if let ref = hotKeyRef {
            UnregisterEventHotKey(ref)
            hotKeyRef = nil
        }
    }

    fileprivate static func handleHotkey() {
        DispatchQueue.main.async {
            instance?.callback()
        }
    }

    deinit {
        unregister()
    }
}

// C-compatible function pointer for the Carbon event handler
private func hotkeyCallback(
    _ nextHandler: EventHandlerCallRef?,
    _ event: EventRef?,
    _ userData: UnsafeMutableRawPointer?
) -> OSStatus {
    HotkeyManager.handleHotkey()
    return noErr
}
