cask "greg" do
  version "0.3.0"
  sha256 "92f6aca0aa28e1b4c8a2ef7799c2c41b3830675f58e6f5a5603e018133c66077"

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
