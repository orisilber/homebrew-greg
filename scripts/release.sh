#!/bin/bash
set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────────────

REPO="orisilber/homebrew-greg"
FORMULA="Formula/greg.rb"
CASK="Casks/greg.rb"

# ── Helpers ─────────────────────────────────────────────────────────────────

red()    { printf "\033[31m%s\033[0m\n" "$1"; }
green()  { printf "\033[32m%s\033[0m\n" "$1"; }
dim()    { printf "\033[2m%s\033[0m\n" "$1"; }

# ── Checks ──────────────────────────────────────────────────────────────────

if [ -n "$(git status --porcelain)" ]; then
  red "Error: Working directory is not clean. Commit or stash changes first."
  exit 1
fi

# ── Version ─────────────────────────────────────────────────────────────────

CURRENT=$(node -e "console.log(require('./package.json').version)")
echo ""
echo "Current version: $CURRENT"
echo ""
echo "  1) patch  (x.x.X)"
echo "  2) minor  (x.X.0)"
echo "  3) major  (X.0.0)"
echo "  4) custom"
echo ""
read -rp "Bump type [1/2/3/4]: " BUMP_CHOICE

case "$BUMP_CHOICE" in
  1) IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"; PATCH=$((PATCH+1)); VERSION="$MAJOR.$MINOR.$PATCH" ;;
  2) IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"; MINOR=$((MINOR+1)); VERSION="$MAJOR.$MINOR.0" ;;
  3) IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"; MAJOR=$((MAJOR+1)); VERSION="$MAJOR.0.0" ;;
  4) read -rp "Version: " VERSION ;;
  *) red "Invalid choice"; exit 1 ;;
esac

TAG="v$VERSION"
green "Releasing $TAG"

# ── Build CLI ────────────────────────────────────────────────────────────────

dim "Updating package.json version..."
node -e "
  const pkg = require('./package.json');
  pkg.version = '$VERSION';
  require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

dim "Building CLI dist..."
bun run build

# ── Build UI ─────────────────────────────────────────────────────────────────

dim "Building Greg.app..."
bash swift/ui/build.sh

dim "Zipping Greg.app..."
(cd swift/ui/build && rm -f Greg.app.zip && zip -r Greg.app.zip Greg.app)

# ── Commit, tag, push ───────────────────────────────────────────────────────

dim "Committing and tagging..."
git add -A
git commit -m "Release $TAG"
git tag "$TAG"

dim "Pushing to GitHub..."
git push origin main --tags

# ── Create GitHub release with UI app ────────────────────────────────────────

dim "Creating GitHub release with Greg.app..."
gh release create "$TAG" swift/ui/build/Greg.app.zip \
  --title "$TAG" \
  --notes "Release $TAG — CLI and UI"

# ── Update CLI formula SHA ───────────────────────────────────────────────────

TARBALL_URL="https://github.com/$REPO/archive/refs/tags/$TAG.tar.gz"

dim "Downloading tarball to compute SHA256..."
SHA=$(curl -sL "$TARBALL_URL" | shasum -a 256 | awk '{print $1}')

dim "Updating formula (version=$VERSION, sha=$SHA)..."
cat > "$FORMULA" <<RUBY
class Greg < Formula
  desc "Natural language to shell commands — powered by LLMs"
  homepage "https://github.com/$REPO"
  url "$TARBALL_URL"
  sha256 "$SHA"
  version "$VERSION"
  license "MIT"

  depends_on "node"

  def install
    libexec.install "dist/greg.mjs"
    libexec.install "dist/afm-bridge.swift"

    (bin/"greg").write <<~SH
      #!/bin/bash
      exec "#{Formula["node"].opt_bin}/node" "#{libexec}/greg.mjs" "\$@"
    SH
  end

  test do
    assert_match "greg", shell_output("#{bin}/greg --setup 2>&1", 1)
  end
end
RUBY

# ── Update UI cask SHA ───────────────────────────────────────────────────────

APP_ZIP_URL="https://github.com/$REPO/releases/download/$TAG/Greg.app.zip"

dim "Downloading Greg.app.zip to compute SHA256..."
APP_SHA=$(curl -sL "$APP_ZIP_URL" | shasum -a 256 | awk '{print $1}')

dim "Updating cask (version=$VERSION, sha=$APP_SHA)..."
cat > "$CASK" <<RUBY
cask "greg" do
  version "$VERSION"
  sha256 "$APP_SHA"

  url "https://github.com/$REPO/releases/download/v#{version}/Greg.app.zip"
  name "Greg"
  desc "Native macOS floating assistant powered by LLMs"
  homepage "https://github.com/$REPO"

  depends_on macos: ">= :sequoia"

  app "Greg.app"

  zap trash: [
    "~/.config/greg",
  ]
end
RUBY

# ── Commit and push formula + cask ───────────────────────────────────────────

git add "$FORMULA" "$CASK"
git commit -m "Update formula and cask to $TAG"
git push origin main

# ── Done ────────────────────────────────────────────────────────────────────

echo ""
green "Released $TAG"
echo ""
dim "Users can install/upgrade with:"
echo "  brew tap orisilber/greg"
echo "  brew install greg              # CLI"
echo "  brew install --cask greg       # UI app"
echo "  brew upgrade greg              # upgrade CLI"
echo "  brew upgrade --cask greg       # upgrade UI"
echo ""
