#!/usr/bin/env bash
# Create or update an editor User row + append email to EDITORS_ALLOWLIST on VPS.
# Usage (on VPS): ops-create-editor.sh <test|prod> <email> <name> <bcrypt_hash>
set -euo pipefail

ENV="${1:?env required (test|prod)}"
EMAIL="${2:?email required}"
NAME="${3:?name required}"
HASH="${4:?bcrypt hash required}"

COMPOSE="/opt/mini580/${ENV}/docker-compose.yml"
ENVF="/opt/mini580/${ENV}/.env"

if [[ ! -f "$COMPOSE" || ! -f "$ENVF" ]]; then
  echo "Missing stack files for $ENV" >&2
  exit 1
fi

EMAIL_LOWER="$(printf '%s' "$EMAIL" | tr '[:upper:]' '[:lower:]')"

# Resolve DB name from .env (defaults match compose files)
POSTGRES_USER="$(grep -E '^POSTGRES_USER=' "$ENVF" | cut -d= -f2- | tr -d '"' || true)"
POSTGRES_DB="$(grep -E '^POSTGRES_DB=' "$ENVF" | cut -d= -f2- | tr -d '"' || true)"
POSTGRES_USER="${POSTGRES_USER:-mini580}"
if [[ "$ENV" == "prod" ]]; then
  POSTGRES_DB="${POSTGRES_DB:-mini580_prod}"
else
  POSTGRES_DB="${POSTGRES_DB:-mini580_test}"
fi

USER_ID="c$(openssl rand -hex 12)"
NAME_SQL="${NAME//\'/\'\'}"
HASH_SQL="$(printf '%s' "$HASH" | sed "s/'/''/g")"

docker compose -f "$COMPOSE" --env-file "$ENVF" exec -T db \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -c \
  "INSERT INTO \"User\" (id, email, name, \"passwordHash\", \"createdAt\")
   VALUES ('${USER_ID}', '${EMAIL_LOWER}', '${NAME_SQL}', '${HASH_SQL}', NOW())
   ON CONFLICT (email) DO UPDATE
     SET name = EXCLUDED.name,
         \"passwordHash\" = EXCLUDED.\"passwordHash\";"

echo "User upserted: ${EMAIL_LOWER}"

# Append to EDITORS_ALLOWLIST if missing
CURRENT="$(grep -E '^EDITORS_ALLOWLIST=' "$ENVF" | cut -d= -f2- | tr -d '"' || true)"
if printf '%s' "$CURRENT" | tr ',' '\n' | tr '[:upper:]' '[:lower:]' | grep -Fxq "$EMAIL_LOWER"; then
  echo "EDITORS_ALLOWLIST already contains ${EMAIL_LOWER}"
else
  if [[ -n "$CURRENT" ]]; then
    NEW_LIST="${CURRENT},${EMAIL_LOWER}"
  else
    NEW_LIST="${EMAIL_LOWER}"
  fi
  grep -v '^EDITORS_ALLOWLIST=' "$ENVF" > "${ENVF}.tmp" || true
  printf 'EDITORS_ALLOWLIST=%s\n' "$NEW_LIST" >> "${ENVF}.tmp"
  mv "${ENVF}.tmp" "$ENVF"
  chmod 600 "$ENVF"
  echo "EDITORS_ALLOWLIST updated"
  docker compose -f "$COMPOSE" --env-file "$ENVF" up -d web
  echo "web container restarted"
fi

docker compose -f "$COMPOSE" --env-file "$ENVF" exec -T db \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
  "SELECT id, email, name FROM \"User\" WHERE email = '${EMAIL_LOWER}';"
