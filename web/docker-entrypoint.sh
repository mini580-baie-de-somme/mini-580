#!/bin/sh
set -eu

export PATH="/opt/prisma-cli/node_modules/.bin:$PATH"
export NODE_PATH="/opt/prisma-cli/node_modules${NODE_PATH:+:$NODE_PATH}"

# Writable dirs for Cursor SDK local agent state (container user is non-root)
mkdir -p "${CURSOR_CWD:-/tmp/mini580-cursor}" /tmp/.cursor 2>/dev/null || true
export HOME="${HOME:-/tmp}"

MEDIA_ROOT="${MEDIA_ROOT:-/data/media}"
if ! mkdir -p "$MEDIA_ROOT" 2>/dev/null || ! touch "$MEDIA_ROOT/.write-check" 2>/dev/null; then
  echo "ERROR: MEDIA_ROOT is not writable: $MEDIA_ROOT" >&2
  echo "       Host bind mount must be owned by uid 1001 (nextjs)." >&2
  echo "       On VPS: sudo chown -R 1001:1001 /opt/mini580/{test,prod}/media" >&2
  ls -lad "$MEDIA_ROOT" 2>/dev/null || true
  # Continue startup so healthchecks work; uploads will fail until fixed.
else
  rm -f "$MEDIA_ROOT/.write-check" 2>/dev/null || true
fi

echo "==> prisma migrate deploy"
prisma migrate deploy

echo "==> starting Next.js"
exec "$@"
