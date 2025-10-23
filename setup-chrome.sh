#!/bin/bash
# setup-chrome.sh - Download and setup Chromium for testing
# Usage: bash setup-chrome.sh

set -e  # Exit on error

CHROME_DIR="./chrome-linux"
CHROME_BINARY="$CHROME_DIR/chrome"

# Configuration - UPDATE THIS URL
CHROME_URL="${CHROME_BINARY_URL:-https://github.com/danbri/glitchcan-minigam/releases/download/chromium-v1/chromium-linux.tar.gz}"

echo "🔍 Checking for Chromium binary..."

if [ -f "$CHROME_BINARY" ]; then
    echo "✅ Chromium already installed at: $CHROME_BINARY"
    $CHROME_BINARY --version 2>/dev/null || echo "⚠️  Binary exists but may not be functional"
    exit 0
fi

echo "📦 Chromium not found. Downloading..."
echo "URL: $CHROME_URL"

# Create temp directory
TEMP_DIR=$(mktemp -d)
ARCHIVE="$TEMP_DIR/chromium.tar.gz"

# Download with progress
if command -v curl &> /dev/null; then
    curl -L --fail "$CHROME_URL" -o "$ARCHIVE" || {
        echo "❌ Download failed. Check URL or network connectivity."
        rm -rf "$TEMP_DIR"
        exit 1
    }
elif command -v wget &> /dev/null; then
    wget -O "$ARCHIVE" "$CHROME_URL" || {
        echo "❌ Download failed. Check URL or network connectivity."
        rm -rf "$TEMP_DIR"
        exit 1
    }
else
    echo "❌ Neither curl nor wget found. Cannot download."
    exit 1
fi

echo "📂 Extracting archive..."
tar -xzf "$ARCHIVE" -C . || {
    echo "❌ Extraction failed. Archive may be corrupted."
    rm -rf "$TEMP_DIR"
    exit 1
}

# Make executable
if [ -f "$CHROME_BINARY" ]; then
    chmod +x "$CHROME_BINARY"
    echo "✅ Chromium installed successfully!"
    echo "📍 Location: $CHROME_BINARY"

    # Test execution
    echo "🧪 Testing binary..."
    $CHROME_BINARY --version 2>/dev/null && echo "✅ Binary works!" || echo "⚠️  Binary may need additional dependencies"
else
    echo "❌ Expected binary not found after extraction."
    echo "Contents of chrome-linux/:"
    ls -la chrome-linux/ || echo "chrome-linux/ directory not found"
    exit 1
fi

# Cleanup
rm -rf "$TEMP_DIR"

echo ""
echo "📝 To use with Playwright, set environment variable:"
echo "   export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=$CHROME_BINARY"
echo ""
echo "Or update playwright.config.js with:"
echo "   use: { channel: 'chrome', executablePath: '$CHROME_BINARY' }"
