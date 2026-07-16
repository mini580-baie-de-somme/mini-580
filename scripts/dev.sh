#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB="$ROOT/web"

echo "==> mini-580 dev startup"

# Check PostgreSQL on port 5432
if ! pg_isready -h localhost -p 5432 -q 2>/dev/null; then
  echo "ERROR: PostgreSQL is not running on localhost:5432"
  echo "Start it with: sudo systemctl start postgresql"
  exit 1
fi
echo "✓ PostgreSQL ready on :5432"

# Ensure .env exists
if [[ ! -f "$WEB/.env" ]]; then
  echo "Copying .env.example → .env"
  cp "$WEB/.env.example" "$WEB/.env"
fi

cd "$WEB"

# Local media bucket (same contract as VPS bind mount)
mkdir -p "$WEB/data/media"
echo "✓ Media bucket: $WEB/data/media"

# Install deps if needed
if [[ ! -d node_modules ]]; then
  echo "==> npm install"
  npm install
fi

# Generate Prisma client
echo "==> prisma generate"
npx prisma generate

# Run migrations
echo "==> prisma migrate dev"
npx prisma migrate dev --name init 2>/dev/null || npx prisma migrate deploy

# Seed database
echo "==> prisma db seed"
npx prisma db seed

# Start Next.js on port 3002 (slot 02 — see scripts/host/projects.conf)
echo "==> next dev on :3002"
export PORT=3002
exec npm run dev -- -p 3002
