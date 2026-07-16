#!/bin/sh
set -eu

export PATH="/opt/prisma-cli/node_modules/.bin:$PATH"

echo "==> prisma migrate deploy"
prisma migrate deploy

echo "==> starting Next.js"
exec "$@"
