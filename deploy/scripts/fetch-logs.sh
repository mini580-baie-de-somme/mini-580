#!/usr/bin/env bash
# Fetch mini580 VPS logs from OpenClaw (or any machine with deploy SSH access).
# Usage: fetch-logs.sh [prod|test] [tail_lines]
set -euo pipefail

ENV_NAME="${1:-prod}"
LOG_TAIL="${2:-2000}"
HOST="${MINI580_DEPLOY_HOST:-2.24.13.70}"
USER="${MINI580_DEPLOY_USER:-deploy}"
KEY="${MINI580_SSH_KEY:-${HOME}/.ssh/id_ed25519_mini580_openclaw}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "$ENV_NAME" != "test" && "$ENV_NAME" != "prod" ]]; then
  echo "Usage: $0 [prod|test] [tail_lines]"
  exit 1
fi

if [[ ! -f "$KEY" ]]; then
  echo "ERROR: SSH key not found: $KEY"
  echo "Generate one: ssh-keygen -t ed25519 -f $KEY -C mini580-openclaw -N \"\""
  echo "Then install pubkey via GitHub Actions → Ops — Install SSH key"
  exit 1
fi

SSH_OPTS=(
  -i "$KEY"
  -o BatchMode=yes
  -o StrictHostKeyChecking=accept-new
  -o ConnectTimeout=30
  -o ServerAliveInterval=15
  -o ServerAliveCountMax=3
)

attempt=1
max_attempts=3
while [[ "$attempt" -le "$max_attempts" ]]; do
  echo "==> SSH fetch attempt $attempt/$max_attempts ($ENV_NAME, tail=$LOG_TAIL)"
  if OPS_ENV="$ENV_NAME" LOG_TAIL="$LOG_TAIL" \
    ssh "${SSH_OPTS[@]}" "${USER}@${HOST}" 'bash -s' < "$SCRIPT_DIR/fetch-logs-remote.sh"; then
    exit 0
  fi
  if [[ "$attempt" -lt "$max_attempts" ]]; then
    echo "Retrying in 10s..."
    sleep 10
  fi
  attempt=$((attempt + 1))
done

echo "ERROR: failed to fetch logs after $max_attempts attempts"
exit 1
