class Greg < Formula
  desc "Natural language to shell commands — powered by LLMs"
  homepage "https://github.com/orisilber/homebrew-greg"
  url "https://github.com/orisilber/homebrew-greg/archive/refs/tags/v0.5.2.tar.gz"
  sha256 "9579ea3263c04447a3314fa17578fe243d1f76eb262d898850f3077aaf1b966c"
  version "0.5.2"
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
