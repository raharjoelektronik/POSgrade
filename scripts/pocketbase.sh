#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# pocketbase.sh - pembungkus binary PocketBase dengan direktori proyek.
#   ./scripts/pocketbase.sh serve
#   ./scripts/pocketbase.sh migrate up
#   ./scripts/pocketbase.sh superuser create admin@posgrade.local rahasia123
# ---------------------------------------------------------------------------
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN="$ROOT_DIR/.tools/pocketbase"

if [ ! -x "$BIN" ]; then
  echo "→ PocketBase belum terpasang, menjalankan setup..."
  bash "$ROOT_DIR/scripts/setup-pocketbase.sh"
fi

# Muat .env bila ada (untuk PB_URL/PORT).
if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT_DIR/.env"
  set +a
fi

# Ekstrak host:port dari PB_URL (default 127.0.0.1:8090).
PB_URL="${PB_URL:-http://127.0.0.1:8090}"
ADDR="${PB_URL#*://}"
ADDR="${ADDR%%/*}"

# Flag --http hanya berlaku untuk perintah `serve`; perintah lain (migrate,
# superuser, ...) akan gagal bila menerimanya.
EXTRA_ARGS=()
if [ "${1:-}" = "serve" ]; then
  EXTRA_ARGS+=(--http "$ADDR")
fi

exec "$BIN" "$@" \
  --dir "$ROOT_DIR/pb/pb_data" \
  --migrationsDir "$ROOT_DIR/pb/pb_migrations" \
  --hooksDir "$ROOT_DIR/pb/pb_hooks" \
  "${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}"
