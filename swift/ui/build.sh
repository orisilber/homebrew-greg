#!/bin/bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD="$DIR/build"
APP="$BUILD/Greg.app"

rm -rf "$BUILD"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

echo "Compiling..."
xcrun swiftc \
    "$DIR/Sources/"*.swift \
    -o "$APP/Contents/MacOS/Greg" \
    -framework Cocoa \
    -framework Carbon \
    -framework SwiftUI \
    -framework Combine \
    -framework FoundationModels \
    -Osize

cp "$DIR/Info.plist" "$APP/Contents/"

echo "Built: $APP"
echo "Run:   open '$APP'"
