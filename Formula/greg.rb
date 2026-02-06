class Greg < Formula
  desc "Natural language to shell commands — powered by LLMs"
  homepage "https://github.com/orisilber/greg-cli"
  url "https://github.com/orisilber/greg-cli/archive/refs/tags/v1.0.0.tar.gz"
  sha256 "c544f98b9ae2f3054cd25f3f081c24b1e0de89858436971cda10320728d387d4"
  version "1.0.0"
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
