#!/usr/bin/env bash
# Enable Let's Encrypt TLS for classmini580.blog + test.classmini580.blog
# MUST run as root (certbot writes /etc/letsencrypt, nginx reload).
#
# From Hostinger hPanel → VPS → Browser terminal (root), or:
#   ssh root@2.24.13.70 'bash -s' < deploy/scripts/enable-tls.sh
#
# Prerequisites: DNS A records for @, www, test → VPS IP; nginx serving HTTP on :80.
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "ERROR: run as root (deploy user has no passwordless sudo on this VPS)"
  exit 1
fi

EMAIL="${CERTBOT_EMAIL:-admin@classmini580.blog}"
DOMAINS=(
  -d classmini580.blog
  -d www.classmini580.blog
  -d test.classmini580.blog
)

echo "==> certbot --nginx ${DOMAINS[*]}"
certbot --nginx "${DOMAINS[@]}" \
  --non-interactive --agree-tos -m "$EMAIL" --redirect

echo "==> nginx test + reload"
nginx -t
systemctl reload nginx

echo "==> verify HTTPS"
for url in https://test.classmini580.blog/api/version https://classmini580.blog/api/version; do
  echo -n "$url → "
  curl -fsS "$url" | jq -r .version
done

echo "TLS enabled OK"
