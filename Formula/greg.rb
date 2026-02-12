class Greg < Formula
  desc "Natural language to shell commands — powered by LLMs"
  homepage "https://github.com/orisilber/homebrew-greg"
  url "https://github.com/orisilber/homebrew-greg/archive/refs/tags/v0.3.1.tar.gz"
  sha256 "04ff53b9f9ca0b7afc3bf1532b55f5d541096cc86d1840c571760ee014ac9570"
  version "0.3.1"
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
