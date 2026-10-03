class Greg < Formula
  desc "Natural language to shell commands — powered by LLMs"
  homepage "https://github.com/orisilber/homebrew-greg"
  url "https://github.com/orisilber/homebrew-greg/archive/refs/tags/v0.5.0.tar.gz"
  sha256 "df95a5577a8c53143672413096817569e6f17e56859f5e92fef8911f39a4c135"
  version "0.5.0"
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
    assert_match "greg #{version}", shell_output("#{bin}/greg --version")
    assert_match "--preview", shell_output("#{bin}/greg --help")
  end
end
