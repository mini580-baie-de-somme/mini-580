#!/usr/bin/env bash
# Bootstrap VPS Hostinger (Ubuntu 24.04) — Docker, nginx, certbot, deploy user, /opt/mini580
# Run as root: bash bootstrap-vps.sh [path-to-ci-public-key]
set -euo pipefail

CI_PUBKEY="${1:-}"
OPT_ROOT="/opt/mini580"
REPO_RAW="${REPO_RAW:-https://raw.githubusercontent.com/mini580-baie-de-somme/mini-580/main}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "ERROR: run as root (ssh mini580-test 'sudo bash ...')"
  exit 1
fi

echo "==> apt update + base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
  ca-certificates curl gnupg ufw nginx certbot python3-certbot-nginx

echo "==> Install Docker Engine"
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  # shellcheck disable=SC1091
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

echo "==> Create deploy user"
if ! id deploy >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash deploy
fi
usermod -aG docker deploy

install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
AUTH_KEYS=/home/deploy/.ssh/authorized_keys
touch "$AUTH_KEYS"
chmod 600 "$AUTH_KEYS"
chown deploy:deploy "$AUTH_KEYS"

if [[ -n "$CI_PUBKEY" && -f "$CI_PUBKEY" ]]; then
  echo "==> Install CI public key for deploy"
  PUB="$(cat "$CI_PUBKEY")"
  grep -qxF "$PUB" "$AUTH_KEYS" || echo "$PUB" >> "$AUTH_KEYS"
elif [[ -n "${CI_PUBKEY_CONTENT:-}" ]]; then
  grep -qxF "$CI_PUBKEY_CONTENT" "$AUTH_KEYS" || echo "$CI_PUBKEY_CONTENT" >> "$AUTH_KEYS"
else
  echo "WARN: no CI public key provided — add later to /home/deploy/.ssh/authorized_keys"
fi

# Also allow current root authorized keys for emergency (optional laptop key already on root)
if [[ -f /root/.ssh/authorized_keys ]]; then
  while IFS= read -r line; do
    [[ -z "$line" || "$line" =~ ^# ]] && continue
    grep -qxF "$line" "$AUTH_KEYS" || echo "$line" >> "$AUTH_KEYS"
  done < /root/.ssh/authorized_keys
fi
chown deploy:deploy "$AUTH_KEYS"

echo "==> Create /opt/mini580/{test,prod,nginx,bin}"
install -d -m 755 -o deploy -g deploy "$OPT_ROOT"/{test,prod,nginx,bin}

# Media buckets on host disk (uid 1001 = nextjs user inside the web image)
echo "==> Create persisted media directories (bind-mounted into web containers)"
install -d -m 755 -o 1001 -g 1001 "$OPT_ROOT/test/media"
install -d -m 755 -o 1001 -g 1001 "$OPT_ROOT/prod/media"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Support both repo layout (.../deploy/scripts) and scp layout (/tmp/mini580-deploy/scripts)
if [[ -f "$SCRIPT_DIR/../docker-compose.test.yml" ]]; then
  DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
elif [[ -f "$SCRIPT_DIR/../../deploy/docker-compose.test.yml" ]]; then
  DEPLOY_DIR="$(cd "$SCRIPT_DIR/../../deploy" && pwd)"
else
  echo "ERROR: cannot locate deploy/ assets next to this script"
  exit 1
fi
echo "Using DEPLOY_DIR=$DEPLOY_DIR"

echo "==> Install compose + nginx configs + deploy.sh"
cp "$DEPLOY_DIR/docker-compose.test.yml" "$OPT_ROOT/test/docker-compose.yml"
cp "$DEPLOY_DIR/docker-compose.prod.yml" "$OPT_ROOT/prod/docker-compose.yml"
cp "$DEPLOY_DIR/nginx/test.classmini580.blog.conf" "$OPT_ROOT/nginx/test.classmini580.blog.conf"
cp "$DEPLOY_DIR/nginx/classmini580.blog.conf" "$OPT_ROOT/nginx/classmini580.blog.conf"
cp "$DEPLOY_DIR/scripts/deploy.sh" "$OPT_ROOT/bin/deploy.sh"
chmod +x "$OPT_ROOT/bin/deploy.sh"
# Ensure media dirs exist even on re-bootstrap
install -d -m 755 -o 1001 -g 1001 "$OPT_ROOT/test/media"
install -d -m 755 -o 1001 -g 1001 "$OPT_ROOT/prod/media"
chown -R deploy:deploy "$OPT_ROOT"/{test,prod,nginx,bin}
# Keep media owned by container user (not deploy)
chown -R 1001:1001 "$OPT_ROOT/test/media" "$OPT_ROOT/prod/media"

if [[ ! -f "$OPT_ROOT/test/.env" ]]; then
  cp "$DEPLOY_DIR/env.test.example" "$OPT_ROOT/test/.env"
  TEST_DB_PW="$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)"
  TEST_SESS="$(openssl rand -base64 48 | tr -d '/+=' | head -c 48)"
  sed -i "s/CHANGE_ME_TEST_DB_PASSWORD/${TEST_DB_PW}/" "$OPT_ROOT/test/.env"
  sed -i "s/CHANGE_ME_TEST_SESSION_SECRET_MIN_32_CHARS_XXXX/${TEST_SESS}/" "$OPT_ROOT/test/.env"
  chmod 600 "$OPT_ROOT/test/.env"
  chown deploy:deploy "$OPT_ROOT/test/.env"
  echo "Created $OPT_ROOT/test/.env with generated secrets"
fi

if [[ ! -f "$OPT_ROOT/prod/.env" ]]; then
  cp "$DEPLOY_DIR/env.prod.example" "$OPT_ROOT/prod/.env"
  PROD_DB_PW="$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)"
  PROD_SESS="$(openssl rand -base64 48 | tr -d '/+=' | head -c 48)"
  sed -i "s/CHANGE_ME_PROD_DB_PASSWORD/${PROD_DB_PW}/" "$OPT_ROOT/prod/.env"
  sed -i "s/CHANGE_ME_PROD_SESSION_SECRET_MIN_32_CHARS_XXXX/${PROD_SESS}/" "$OPT_ROOT/prod/.env"
  chmod 600 "$OPT_ROOT/prod/.env"
  chown deploy:deploy "$OPT_ROOT/prod/.env"
  echo "Created $OPT_ROOT/prod/.env with generated secrets"
fi

echo "==> nginx sites"
cp "$OPT_ROOT/nginx/test.classmini580.blog.conf" /etc/nginx/sites-available/test.classmini580.blog.conf
cp "$OPT_ROOT/nginx/classmini580.blog.conf" /etc/nginx/sites-available/classmini580.blog.conf
ln -sfn /etc/nginx/sites-available/test.classmini580.blog.conf /etc/nginx/sites-enabled/
ln -sfn /etc/nginx/sites-available/classmini580.blog.conf /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl reload nginx

echo "==> firewall (22, 80, 443)"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable || true

echo ""
echo "Bootstrap complete."
echo "Next:"
echo "  1. DNS A records: @ www test → $(curl -fsSL ifconfig.me 2>/dev/null || echo '2.24.13.70')"
echo "  2. docker login ghcr.io as deploy (read token)"
echo "  3. /opt/mini580/bin/deploy.sh test <image>"
echo "  4. TLS: certbot --nginx -d test.classmini580.blog -d classmini580.blog -d www.classmini580.blog"
echo ""
echo "Seed TEST after first deploy:"
echo "  docker compose -f /opt/mini580/test/docker-compose.yml --env-file /opt/mini580/test/.env exec web sh -c 'echo seed via local tooling or prisma studio'"
