import Foundation

struct HotkeyConfig: Codable {
    let key: String
    let modifiers: [String]
}

struct GregConfig: Codable {
    let provider: String
    let apiKey: String?
    let model: String?
    let hotkey: HotkeyConfig?

    static let configPath = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent(".config/greg/config.json").path

    static func load() -> GregConfig? {
        guard let data = FileManager.default.contents(atPath: configPath) else {
            return nil
        }
        return try? JSONDecoder().decode(GregConfig.self, from: data)
    }
}
