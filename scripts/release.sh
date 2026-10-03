#!/bin/bash
set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────────────

REPO="orisilber/homebrew-greg"
FORMULA="Formula/greg.rb"

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
if [ "$#" -gt 1 ]; then
  red "Usage: scripts/release.sh [x.y.z]"
  exit 1
fi

if [ "$#" -eq 1 ]; then
  VERSION="$1"
else
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
fi

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  red "Version must use x.y.z format."
  exit 1
fi
if [ "$(git branch --show-current)" != "main" ]; then
  red "Release from main after committing and pushing the feature."
  exit 1
fi
if git rev-parse --verify --quiet "refs/tags/v$VERSION" >/dev/null; then
  red "Tag v$VERSION already exists."
  exit 1
fi

TAG="v$VERSION"
green "Releasing $TAG"

# ── Build CLI ────────────────────────────────────────────────────────────────

dim "Updating package.json version..."
node -e "
  const pkg = require('./package.json');
  pkg.version = '$VERSION';
  require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

dim "Checking and building the release..."
bun run check
bun run test

# ── Commit, tag, push ───────────────────────────────────────────────────────

dim "Committing and tagging..."
git add -- package.json dist/greg.mjs dist/afm-bridge.swift
git commit -m "Release $TAG"
git tag "$TAG"

dim "Pushing to GitHub..."
git push origin main "$TAG"

# ── Create GitHub release ───────────────────────────────────────────────────

dim "Creating GitHub release..."
gh release create "$TAG" \
  --title "$TAG" \
  --notes "Release $TAG"

# ── Update CLI formula SHA ───────────────────────────────────────────────────

TARBALL_URL="https://github.com/$REPO/archive/refs/tags/$TAG.tar.gz"

dim "Downloading tarball to compute SHA256..."
ARCHIVE=$(mktemp)
trap 'rm -f "$ARCHIVE"' EXIT
curl --fail --location --retry 3 "$TARBALL_URL" -o "$ARCHIVE"
tar -tzf "$ARCHIVE" >/dev/null
SHA=$(shasum -a 256 "$ARCHIVE" | awk '{print $1}')

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
    assert_match "greg #{version}", shell_output("#{bin}/greg --version")
    assert_match "--preview", shell_output("#{bin}/greg --help")
  end
end
RUBY

# ── Commit and push formula ─────────────────────────────────────────────────

git add "$FORMULA"
git commit -m "Update formula to $TAG"
git push origin main

# ── Done ────────────────────────────────────────────────────────────────────

echo ""
green "Released $TAG"
echo ""
dim "Users can install/upgrade with:"
echo "  brew tap orisilber/greg"
echo "  brew install greg"
echo "  brew upgrade greg"
echo ""
