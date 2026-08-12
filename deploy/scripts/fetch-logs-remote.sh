#!/usr/bin/env bash
# Run on the mini580 VPS (via SSH). Fetches stack status, permissions, and filtered web logs.
# Env: OPS_ENV=test|prod (required), LOG_TAIL=lines (default 2000)
set -euo pipefail

OPS_ENV="${OPS_ENV:?OPS_ENV required (test or prod)}"
LOG_TAIL="${LOG_TAIL:-2000}"

COMPOSE="/opt/mini580/${OPS_ENV}/docker-compose.yml"
ENVF="/opt/mini580/${OPS_ENV}/.env"
MEDIA="/opt/mini580/${OPS_ENV}/media"
PORT="$([ "$OPS_ENV" = prod ] && echo 3000 || echo 3001)"
POSTGRES_DB="$(grep -E '^POSTGRES_DB=' "$ENVF" 2>/dev/null | cut -d= -f2- | tr -d '"'"'"'"' || true)"
POSTGRES_DB="${POSTGRES_DB:-mini580_${OPS_ENV}}"

echo "===== stack ps ====="
docker compose -f "$COMPOSE" --env-file "$ENVF" ps || true

echo "===== media dir perms ====="
ls -lad "$MEDIA" || true
ls -la "$MEDIA" 2>/dev/null | head -5 || true

echo "===== write check as uid 1001 ====="
docker compose -f "$COMPOSE" --env-file "$ENVF" exec -T -u 1001 web \
  sh -c 'mkdir -p /data/media/_permcheck && rmdir /data/media/_permcheck && echo write_ok' \
  || echo "WRITE_CHECK_FAILED"

echo "===== version ====="
curl -fsS "http://127.0.0.1:${PORT}/api/version" || true
echo

echo "===== recent web logs (errors/warn) ====="
docker compose -f "$COMPOSE" --env-file "$ENVF" logs --tail="$LOG_TAIL" web 2>&1 \
  | grep -iE 'error|warn|failed|EACCES|permission|integrity|rebake|layout rebake|image patch|patch failed|Origin|422|500|413' \
  | tail -300 || true

echo "===== media file count ====="
find "$MEDIA" -type f 2>/dev/null | wc -l || true
find "$MEDIA" -type f 2>/dev/null | tail -10 || true

echo "===== recent media layout + variant mtimes ====="
docker compose -f "$COMPOSE" --env-file "$ENVF" exec -T db \
  psql -U mini580 -d "$POSTGRES_DB" -t -A -F'|' -c \
  "SELECT id, \"scaleX\", \"scaleY\", \"rotation\", \"offsetX\", \"offsetY\", LEFT(\"urlMoyenne\",80), \"updatedAt\"::text FROM \"Media\" WHERE kind='IMAGE' ORDER BY \"updatedAt\" DESC LIMIT 5;" 2>/dev/null \
  | while IFS='|' read -r mid sx sy rot ox oy moy updated; do
      echo "MEDIA $mid updated=$updated scale=$sx rot=$rot offset=$ox,$oy"
      echo "  urlMoyenne=$moy"
      vkey=$(echo "$moy" | sed 's|^/media/||')
      if [ -n "$vkey" ] && [ -f "$MEDIA/$vkey" ]; then
        stat -c "  moyenne mtime=%y size=%s" "$MEDIA/$vkey" 2>/dev/null || ls -la "$MEDIA/$vkey"
      fi
    done || true

docker compose -f "$COMPOSE" --env-file "$ENVF" exec -T db \
  psql -U mini580 -d "$POSTGRES_DB" -t -A -F'|' -c \
  "SELECT id, \"urlOrigin\", \"urlMoyenne\", \"updatedAt\"::text FROM \"Media\" WHERE kind='IMAGE' ORDER BY \"updatedAt\" DESC LIMIT 10;" 2>/dev/null \
  | while IFS='|' read -r mid origin moyenne updated; do
      key=$(echo "$origin" | sed 's|^/media/||')
      if [ -n "$key" ] && [ -f "$MEDIA/$key" ]; then
        echo "OK origin $mid $updated"
      else
        echo "MISSING origin $mid $updated path=$MEDIA/$key"
      fi
      vkey=$(echo "$moyenne" | sed 's|^/media/||')
      if [ -n "$vkey" ] && [ -f "$MEDIA/$vkey" ]; then
        echo "  OK moyenne"
      else
        echo "  MISSING moyenne path=$MEDIA/$vkey"
      fi
    done || true

echo "===== last 50 PATCH requests in logs (raw) ====="
docker compose -f "$COMPOSE" --env-file "$ENVF" logs --tail="$LOG_TAIL" web 2>&1 \
  | grep -iE 'PATCH|images/|media-library' | tail -50 || true

echo "===== DONE ====="
