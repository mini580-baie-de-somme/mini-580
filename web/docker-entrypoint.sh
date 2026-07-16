#!/bin/sh
set -eu

export PATH="/opt/prisma-cli/node_modules/.bin:$PATH"
export NODE_PATH="/opt/prisma-cli/node_modules${NODE_PATH:+:$NODE_PATH}"

# Writable dirs for Cursor SDK local agent state (container user is non-root)
mkdir -p "${CURSOR_CWD:-/tmp/mini580-cursor}" /tmp/.cursor 2>/dev/null || true
export HOME="${HOME:-/tmp}"

echo "==> prisma migrate deploy"
prisma migrate deploy

echo "==> starting Next.js"
exec "$@"
