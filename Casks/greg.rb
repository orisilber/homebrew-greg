cask "greg" do
  version "0.3.1"
  sha256 "3cef3b09d1c6ed7d6192419361c754695a7bd8a3a43128465814f5a7d73e2773"

  url "https://github.com/orisilber/homebrew-greg/releases/download/v#{version}/Greg.app.zip"
  name "Greg"
  desc "Native macOS floating assistant powered by LLMs"
  homepage "https://github.com/orisilber/homebrew-greg"

  depends_on macos: ">= :sequoia"

  app "Greg.app"

  zap trash: [
    "~/.config/greg",
  ]
end
