import Foundation
import Combine

class PanelState: ObservableObject {
    @Published var input: String = ""
    @Published var response: String = ""
    @Published var showCount: Int = 0

    func didShow() {
        showCount += 1
    }

    func reset() {
        input = ""
        response = ""
    }
}
