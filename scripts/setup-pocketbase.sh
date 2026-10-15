#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# setup-pocketbase.sh - unduh binary PocketBase ke folder .tools/
# Idempotent: aman dijalankan berulang kali.
# ---------------------------------------------------------------------------
set -euo pipefail

PB_VERSION="${PB_VERSION:-0.40.5}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOOLS_DIR="$ROOT_DIR/.tools"
BIN="$TOOLS_DIR/pocketbase"

if [ -x "$BIN" ]; then
  echo "✓ PocketBase sudah ada: $($BIN --version)"
  exit 0
fi

case "$(uname -s)" in
  Linux)  OS="linux" ;;
  Darwin) OS="darwin" ;;
  *)      echo "✖ OS tidak didukung: $(uname -s). Unduh manual dari https://github.com/pocketbase/pocketbase/releases"; exit 1 ;;
esac

case "$(uname -m)" in
  x86_64|amd64) ARCH="amd64" ;;
  arm64|aarch64) ARCH="arm64" ;;
  *) echo "✖ Arsitektur tidak didukung: $(uname -m)"; exit 1 ;;
esac

URL="https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_${OS}_${ARCH}.zip"

mkdir -p "$TOOLS_DIR"
echo "→ Mengunduh PocketBase v${PB_VERSION} (${OS}/${ARCH})..."
curl -fsSL -o "$TOOLS_DIR/pocketbase.zip" "$URL"
unzip -oq "$TOOLS_DIR/pocketbase.zip" -d "$TOOLS_DIR"
chmod +x "$BIN"
rm -f "$TOOLS_DIR/pocketbase.zip"

echo "✓ Terpasang: $($BIN --version)"
