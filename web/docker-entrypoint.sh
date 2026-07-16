#!/bin/sh
set -eu

export PATH="/opt/prisma-cli/node_modules/.bin:$PATH"
export NODE_PATH="/opt/prisma-cli/node_modules${NODE_PATH:+:$NODE_PATH}"

echo "==> prisma migrate deploy"
prisma migrate deploy

echo "==> starting Next.js"
exec "$@"
