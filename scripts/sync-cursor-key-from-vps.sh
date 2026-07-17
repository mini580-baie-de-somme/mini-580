#!/usr/bin/env bash
# Refresh local Cursor key from the VPS TEST .env (populated by Deploy from GitHub Secrets).
# GitHub does not allow reading secret *values* back via the API — the deploy pipeline
# is the bridge: GitHub Secret → VPS .env → this script → web/.env.cursor.local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/web/.env.cursor.local"
SSH_HOST="${MINI580_SSH_HOST:-mini580-test}"
ENV_REMOTE="${MINI580_TEST_ENV:-/opt/mini580/test/.env}"

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

ssh -o BatchMode=yes "$SSH_HOST" "grep -E '^(CURSOR_API_KEY|CURSOR_MODEL)=' '$ENV_REMOTE'" >"$tmp"

if ! grep -q '^CURSOR_API_KEY=.\+' "$tmp"; then
  echo "CURSOR_API_KEY not found on $SSH_HOST:$ENV_REMOTE" >&2
  echo "Ensure Deploy TEST has written the GitHub secret to the VPS .env" >&2
  exit 1
fi

# Normalize model default
if ! grep -q '^CURSOR_MODEL=.\+' "$tmp"; then
  echo 'CURSOR_MODEL=composer-2.5' >>"$tmp"
fi

umask 077
cp "$tmp" "$OUT"
chmod 600 "$OUT"

key_len="$(grep '^CURSOR_API_KEY=' "$OUT" | cut -d= -f2- | tr -d '"' | wc -c | tr -d ' ')"
echo "Wrote $OUT (CURSOR_API_KEY len=$((key_len)) from $SSH_HOST — not for git)"
