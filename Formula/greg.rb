class Greg < Formula
  desc "Natural language to shell commands — powered by LLMs"
  homepage "https://github.com/orisilber/homebrew-greg"
  url "https://github.com/orisilber/homebrew-greg/archive/refs/tags/v1.0.1.tar.gz"
  sha256 "f73d0eaf1f25b08c2886ef8d47f144adcc608f4338a6f21740545836aa17ae37"
  version "1.0.1"
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
