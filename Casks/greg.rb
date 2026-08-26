cask "greg" do
  version "0.4.0"
  sha256 "0413c5e87df85a4dd802153a532646b76142ede3b81936f1c5290bb212ae2e88"

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
