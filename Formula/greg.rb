class Greg < Formula
  desc "Natural language to shell commands — powered by LLMs"
  homepage "https://github.com/orisilber/homebrew-greg"
  url "https://github.com/orisilber/homebrew-greg/archive/refs/tags/v1.0.3.tar.gz"
  sha256 "2110a5047ea8572d1a6cb59ca7487338057ca3b88e36d4577e3cf9c9a9a7ee59"
  version "1.0.3"
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
