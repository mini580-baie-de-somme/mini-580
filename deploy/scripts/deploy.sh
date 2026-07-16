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
