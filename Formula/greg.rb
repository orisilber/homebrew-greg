class Greg < Formula
  desc "Natural language to shell commands — powered by LLMs"
  homepage "https://github.com/orisilber/homebrew-greg"
  url "https://github.com/orisilber/homebrew-greg/archive/refs/tags/v0.5.1.tar.gz"
  sha256 "a28c69fdaae0ab0ab39e35caafa5409d42ac43a5a450f225e51cd40d891409a5"
  version "0.5.1"
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
