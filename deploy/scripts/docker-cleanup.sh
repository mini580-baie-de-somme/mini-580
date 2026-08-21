#!/usr/bin/env bash
# Post-deploy Docker cleanup on the VPS.
# Removes unused images and build cache; running stacks (test/prod) are kept.
# Safe to run after every deploy — prevents disk exhaustion from stale GHCR layers.
set -euo pipefail

echo "==> docker cleanup (post-deploy)"
echo "===== disk before ====="
df -h / || true
echo "===== docker df before ====="
docker system df || true

echo "===== prune unused images and build cache ====="
docker image prune -af || true
docker builder prune -af || true
docker system prune -af || true

echo "===== remove stale CI deploy sync temp ====="
rm -rf /tmp/mini580-deploy-sync 2>/dev/null || true

echo "===== disk after ====="
df -h / || true
echo "===== docker df after ====="
docker system df || true
echo "OK — docker cleanup done"
