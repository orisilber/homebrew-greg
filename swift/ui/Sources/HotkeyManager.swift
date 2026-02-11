import Carbon
import Cocoa

class HotkeyManager {
    private var hotKeyRef: EventHotKeyRef?
    private var handlerRef: EventHandlerRef?
    private static var instance: HotkeyManager?

    private let callback: () -> Void

    init(callback: @escaping () -> Void) {
        self.callback = callback
        HotkeyManager.instance = self
    }

    func register() {
        // Read hotkey from config, or use default (Ctrl+Shift+Space)
        var modifiers: UInt32 = UInt32(controlKey | shiftKey)
        var keyCode: UInt32 = 49 // Space

        if let config = GregConfig.load(),
           let hotkey = config.hotkey {
            modifiers = mapModifiers(hotkey.modifiers)
            keyCode = mapKeyCode(hotkey.key)
        }

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
            &handlerRef
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
        if let ref = handlerRef {
            RemoveEventHandler(ref)
            handlerRef = nil
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

    // MARK: - Key mapping

    private func mapModifiers(_ names: [String]) -> UInt32 {
        var result: UInt32 = 0
        for name in names {
            switch name.lowercased() {
            case "command", "cmd":   result |= UInt32(cmdKey)
            case "option", "alt":    result |= UInt32(optionKey)
            case "shift":            result |= UInt32(shiftKey)
            case "control", "ctrl":  result |= UInt32(controlKey)
            default: break
            }
        }
        return result
    }

    private func mapKeyCode(_ name: String) -> UInt32 {
        switch name.lowercased() {
        case "a": return 0
        case "s": return 1
        case "d": return 2
        case "f": return 3
        case "g": return 5
        case "h": return 4
        case "z": return 6
        case "x": return 7
        case "c": return 8
        case "v": return 9
        case "b": return 11
        case "q": return 12
        case "w": return 13
        case "e": return 14
        case "r": return 15
        case "y": return 16
        case "t": return 17
        case "1": return 18
        case "2": return 19
        case "3": return 20
        case "4": return 21
        case "5": return 23
        case "6": return 22
        case "7": return 26
        case "8": return 28
        case "9": return 25
        case "0": return 29
        case "o": return 31
        case "u": return 32
        case "i": return 34
        case "p": return 35
        case "l": return 37
        case "j": return 38
        case "k": return 40
        case "n": return 45
        case "m": return 46
        case "return", "enter": return 36
        case "tab": return 48
        case "space": return 49
        case "delete", "backspace": return 51
        case "escape", "esc": return 53
        case "f1": return 122
        case "f2": return 120
        case "f3": return 99
        case "f4": return 118
        case "f5": return 96
        case "f6": return 97
        case "f7": return 98
        case "f8": return 100
        case "f9": return 101
        case "f10": return 109
        case "f11": return 103
        case "f12": return 111
        default: return 49 // fallback to Space
        }
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
