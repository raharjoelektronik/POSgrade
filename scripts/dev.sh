#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# dev.sh - jalankan PocketBase + Node.js sekaligus, satu perintah.
#   npm run dev
# Ctrl+C akan menghentikan keduanya.
# ---------------------------------------------------------------------------
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# --- Siapkan .env dari contoh bila belum ada -------------------------------
if [ ! -f .env ]; then
  cp .env.example .env
  echo "→ .env dibuat dari .env.example"
fi

set -a
# shellcheck disable=SC1091
. ./.env
set +a

# --- Pastikan PocketBase terpasang ----------------------------------------
bash scripts/setup-pocketbase.sh

# --- Pastikan superuser pertama ada ---------------------------------------
if [ -n "${PB_ADMIN_EMAIL:-}" ] && [ -n "${PB_ADMIN_PASSWORD:-}" ]; then
  bash scripts/pocketbase.sh superuser upsert "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD" >/dev/null 2>&1 \
    && echo "→ Superuser PocketBase siap: $PB_ADMIN_EMAIL" \
    || echo "→ Superuser sudah ada / dilewati"
fi

# --- Jalankan PocketBase di background ------------------------------------
bash scripts/pocketbase.sh serve > "$ROOT_DIR/.tools/pocketbase.log" 2>&1 &
PB_PID=$!

cleanup() {
  echo ""
  echo "→ Menghentikan PocketBase (pid $PB_PID)..."
  kill "$PB_PID" 2>/dev/null || true
  wait "$PB_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Tunggu PocketBase siap menerima request.
for _ in $(seq 1 40); do
  if curl -fsS "${PB_URL:-http://127.0.0.1:8090}/api/health" >/dev/null 2>&1; then
    echo "→ PocketBase siap di ${PB_URL:-http://127.0.0.1:8090}"
    break
  fi
  sleep 0.25
done

echo "→ Log PocketBase: .tools/pocketbase.log"
echo ""

# --- Jalankan server Node (foreground) ------------------------------------
node server/index.js
