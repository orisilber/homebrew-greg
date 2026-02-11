class Greg < Formula
  desc "Natural language to shell commands — powered by LLMs"
  homepage "https://github.com/orisilber/homebrew-greg"
  url "https://github.com/orisilber/homebrew-greg/archive/refs/tags/v1.2.0.tar.gz"
  sha256 "1c6305880165d3bd5406323cbbb9cc71a3d32ccb638dd2f1c396d4a64f5a8faa"
  version "1.2.0"
  license "MIT"

  depends_on "node"

  def install
    libexec.install "dist/greg.mjs"
    libexec.install "dist/afm-bridge.swift"

    (bin/"greg").write <<~SH
      #!/bin/bash
      exec "#{Formula["node"].opt_bin}/node" "#{libexec}/greg.mjs" "$@"
    SH
  end

  test do
    assert_match "greg", shell_output("#{bin}/greg --setup 2>&1", 1)
  end
end
