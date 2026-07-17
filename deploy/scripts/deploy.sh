#!/usr/bin/env bash
# Deploy stack TEST or PROD on the VPS
# Usage: deploy.sh <test|prod> [image]
# Example: deploy.sh test ghcr.io/mini580-baie-de-somme/mini-580:test
set -euo pipefail

ENV_NAME="${1:-}"
IMAGE_ARG="${2:-}"
OPT_ROOT="${OPT_ROOT:-/opt/mini580}"
REGISTRY_IMAGE="${REGISTRY_IMAGE:-ghcr.io/mini580-baie-de-somme/mini-580}"

if [[ "$ENV_NAME" != "test" && "$ENV_NAME" != "prod" ]]; then
  echo "Usage: $0 <test|prod> [image]"
  exit 1
fi

DIR="$OPT_ROOT/$ENV_NAME"
COMPOSE="$DIR/docker-compose.yml"
ENV_FILE="$DIR/.env"

if [[ ! -f "$COMPOSE" ]]; then
  echo "ERROR: missing $COMPOSE"
  exit 1
fi
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: missing $ENV_FILE"
  exit 1
fi

if [[ -n "$IMAGE_ARG" ]]; then
  IMAGE="$IMAGE_ARG"
elif [[ -n "${IMAGE:-}" ]]; then
  IMAGE="$IMAGE"
else
  IMAGE="${REGISTRY_IMAGE}:${ENV_NAME}"
fi

echo "==> Deploy $ENV_NAME"
echo "    IMAGE=$IMAGE"
echo "    DIR=$DIR"

# Ensure host media bucket exists (bind mount ./media → /data/media)
# Container runs as uid/gid 1001 (nextjs) — host dir must be writable by that user.
MEDIA_DIR="$DIR/media"
mkdir -p "$MEDIA_DIR"
# Prefer Docker root (works without passwordless sudo) then sudo/root fallbacks.
if command -v docker >/dev/null 2>&1; then
  docker run --rm -v "${MEDIA_DIR}:/data/media" alpine:3.20 \
    sh -c 'chown -R 1001:1001 /data/media && chmod -R u+rwX,g+rX,o+rX /data/media'
elif command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
  sudo chown -R 1001:1001 "$MEDIA_DIR"
  sudo chmod -R u+rwX,g+rX,o+rX "$MEDIA_DIR"
elif [[ "$(id -u)" -eq 0 ]]; then
  chown -R 1001:1001 "$MEDIA_DIR"
  chmod -R u+rwX,g+rX,o+rX "$MEDIA_DIR"
else
  echo "WARNING: cannot chown $MEDIA_DIR to 1001:1001"
  ls -lad "$MEDIA_DIR" || true
fi
ls -lad "$MEDIA_DIR" || true

# Persist IMAGE in .env for compose variable substitution
if grep -q '^IMAGE=' "$ENV_FILE"; then
  sed -i "s|^IMAGE=.*|IMAGE=${IMAGE}|" "$ENV_FILE"
else
  echo "IMAGE=${IMAGE}" >> "$ENV_FILE"
fi

export IMAGE
cd "$DIR"

# Optional: /opt/mini580/.ghcr-token (read-only PAT) for private GHCR packages
if [[ -f "$OPT_ROOT/.ghcr-token" ]]; then
  echo "==> docker login ghcr.io"
  GHCR_USER="${GHCR_USER:-$(whoami)}"
  tr -d '\n' < "$OPT_ROOT/.ghcr-token" | docker login ghcr.io -u "$GHCR_USER" --password-stdin
fi

echo "==> docker pull"
docker pull "$IMAGE"

echo "==> docker compose up -d"
docker compose -f "$COMPOSE" --env-file "$ENV_FILE" up -d --remove-orphans

echo "==> wait for web healthy"
PORT=3001
[[ "$ENV_NAME" == "prod" ]] && PORT=3000

ok=0
for i in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 2
done

if [[ "$ok" -ne 1 ]]; then
  echo "ERROR: healthcheck failed on :${PORT}"
  docker compose -f "$COMPOSE" --env-file "$ENV_FILE" logs --tail=80 web || true
  exit 1
fi

echo "OK — $ENV_NAME is up on 127.0.0.1:${PORT}"
docker compose -f "$COMPOSE" --env-file "$ENV_FILE" ps
