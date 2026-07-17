# Déploiement & CI/CD — Hostinger VPS

> classmini580.blog · TEST auto / PROD manuel · Docker Compose

## Architecture

| Environnement | Domaine | Port local | Trigger |
|---------------|---------|------------|---------|
| **TEST** | `test.classmini580.blog` | `127.0.0.1:3001` | Push sur `main` |
| **PROD** | `classmini580.blog` (+ `www`) | `127.0.0.1:3000` | Workflow manuel `Deploy PROD` |

VPS : `2.24.13.70` · stacks isolées sous `/opt/mini580/{test,prod}` · images GHCR `ghcr.io/mini580-baie-de-somme/mini-580`.

## DNS (Hostinger)

| Type | Nom | Valeur |
|------|-----|--------|
| A | `@` | `2.24.13.70` |
| A | `www` | `2.24.13.70` |
| A | `test` | `2.24.13.70` |

## Secrets GitHub (repo `mini580-baie-de-somme/mini-580`)

Chaque deploy **réécrit** les secrets applicatifs dans `/opt/mini580/{test,prod}/.env` depuis GitHub (jamais commités). Les workflows utilisent les **environments** `test` et `prod`.

### Repo (partagés)

| Secret | Rôle |
|--------|------|
| `DEPLOY_HOST` | `2.24.13.70` |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_SSH_KEY` | Clé privée CI (`~/.ssh/id_ed25519_mini580_ci`) |
| `CURSOR_API_KEY` | Modèle IA (Cursor Dashboard) — aussi injecté dans le workflow **Tests** |
| `CURSOR_MODEL` | Défaut `composer-2.5` |

`GITHUB_TOKEN` (Actions) sert au push/pull GHCR (`packages: write`).

### Environment `test` / `prod` (par stack)

| Secret | Rôle |
|--------|------|
| `TELEGRAM_BOT_TOKEN` | Bot dédié (TEST ≠ PROD — un webhook par bot) |
| `TELEGRAM_WEBHOOK_SECRET` | Header `secret_token` webhook |
| `TELEGRAM_ALLOWED_USER_IDS` | Allowlist IDs numériques |
| `TELEGRAM_SERVICE_USER_EMAIL` | Auteur DB des posts bot |
| `INGEST_API_KEY` | Bearer machine (OpenClaw / tools) |
| `SYNC_PRIVATE_KEY` | OTP sync Ed25519 (cette stack) |
| `SYNC_PEER_PUBLIC_KEY` | Clé publique de l’autre stack |
| `SESSION_SECRET` | Sessions Next.js |
| `POSTGRES_PASSWORD` | Mot de passe Postgres |

### Pull GHCR depuis le VPS

Les workflows passent `GITHUB_TOKEN` au serveur et exécutent `docker login ghcr.io` avant `deploy.sh` (pas besoin de PAT permanent si les deploys passent par Actions).

Optionnel (deploys manuels hors CI) : déposer un PAT `read:packages` dans `/opt/mini580/.ghcr-token` (voir `deploy.sh`).

Astuce alternative : rendre le package GHCR **public** (Package settings sur GitHub).

## Bootstrap VPS (une fois)

Depuis la machine locale (avec le repo cloné) :

```bash
# 1. Générer la clé CI si absente
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_mini580_ci -C "mini580-github-actions" -N ""

# 2. Copier scripts + clé publique sur le VPS et lancer bootstrap
scp -r deploy mini580-test:/tmp/mini580-deploy
scp ~/.ssh/id_ed25519_mini580_ci.pub mini580-test:/tmp/mini580_ci.pub
ssh mini580-test 'sudo bash /tmp/mini580-deploy/scripts/bootstrap-vps.sh /tmp/mini580_ci.pub'
```

Ou, si les fichiers sont déjà sur le serveur via ce dépôt :

```bash
ssh mini580-test 'cd /chemin/vers/repo && sudo bash deploy/scripts/bootstrap-vps.sh /tmp/mini580_ci.pub'
```

## Secrets GitHub CLI

```bash
REPO=mini580-baie-de-somme/mini-580

# Environments
gh api --method PUT "repos/$REPO/environments/test" --input /dev/null
gh api --method PUT "repos/$REPO/environments/prod" --input /dev/null

# Repo
gh secret set DEPLOY_HOST --body "2.24.13.70" --repo "$REPO"
gh secret set DEPLOY_USER --body "deploy" --repo "$REPO"
gh secret set DEPLOY_SSH_KEY < ~/.ssh/id_ed25519_mini580_ci --repo "$REPO"
gh secret set CURSOR_API_KEY --repo "$REPO"          # interactif / stdin
gh secret set CURSOR_MODEL --body "composer-2.5" --repo "$REPO"

# Par environment (répéter --env test et --env prod)
gh secret set TELEGRAM_BOT_TOKEN --env test --repo "$REPO"
gh secret set TELEGRAM_WEBHOOK_SECRET --env test --repo "$REPO"
gh secret set TELEGRAM_ALLOWED_USER_IDS --env test --repo "$REPO"
gh secret set TELEGRAM_SERVICE_USER_EMAIL --env test --repo "$REPO"
gh secret set INGEST_API_KEY --env test --repo "$REPO"
gh secret set SYNC_PRIVATE_KEY --env test --repo "$REPO"
gh secret set SYNC_PEER_PUBLIC_KEY --env test --repo "$REPO"
gh secret set SESSION_SECRET --env test --repo "$REPO"
gh secret set POSTGRES_PASSWORD --env test --repo "$REPO"
# idem --env prod
```

Après un changement de secret : relancer **Deploy TEST** (push `main` ou manuel) et/ou **Deploy PROD** — le `.env` VPS est mis à jour automatiquement.

## Déploiements

### TEST (automatique)

Chaque push sur `main` → workflow **Deploy TEST** → build → `ghcr.io/.../mini-580:test` → `/opt/mini580/bin/deploy.sh test`.

Relancer à la main : Actions → Deploy TEST → Run workflow.

### PROD (manuel)

Actions → **Deploy PROD** → Run workflow → saisir `deploy-prod` dans le champ confirm.

## TLS (après DNS propagé)

```bash
ssh mini580-test 'sudo certbot --nginx \
  -d classmini580.blog -d www.classmini580.blog -d test.classmini580.blog \
  --non-interactive --agree-tos -m VOTRE_EMAIL --redirect'
```

## Seed base TEST (premier boot)

Les migrations Prisma tournent au démarrage du container (`docker-entrypoint.sh`).

Pour charger le seed (articles + jalons) en TEST, depuis une machine avec le repo et accès DB, ou en one-shot :

```bash
# Exemple : exécuter le seed contre la DB TEST via tunnel SSH
# ssh -L 5433:127.0.0.1:5432 ... (si un port DB était exposé — par défaut il ne l'est pas)

# Alternative : docker compose run avec le code seed monté (à faire au besoin)
ssh mini580-test 'docker compose -f /opt/mini580/test/docker-compose.yml --env-file /opt/mini580/test/.env ps'
```

Créer un utilisateur éditeur via seed local pointant temporairement vers la DB, ou utiliser l’API après avoir créé un user manuellement en SQL.

## Médias persistés (bucket local style S3)

Les images uploadées ne vivent **pas** dans le filesystem éphémère du container.

| Env | Disque VPS (hôte) | Mount container | URL publique |
|-----|-------------------|-----------------|--------------|
| TEST | `/opt/mini580/test/media` | `/data/media` | `https://test.classmini580.blog/media/…` |
| PROD | `/opt/mini580/prod/media` | `/data/media` | `https://classmini580.blog/media/…` |

- API maison (Node `fs` uniquement) : `POST /api/media`, `PUT|DELETE|HEAD /api/media/{key}`, lecture `GET /media/{key}`
- nginx sert `/media/` directement depuis le disque hôte (cache long)
- Propriétaire des dossiers : uid `1001` (user `nextjs` de l’image)

Sur un VPS déjà bootstrapé :

```bash
sudo mkdir -p /opt/mini580/{test,prod}/media
sudo chown -R 1001:1001 /opt/mini580/{test,prod}/media
sudo chmod -R u+rwX,g+rX,o+rX /opt/mini580/{test,prod}/media
# Recopier compose + nginx puis reload
sudo cp /chemin/repo/deploy/docker-compose.test.yml /opt/mini580/test/docker-compose.yml
sudo cp /chemin/repo/deploy/docker-compose.prod.yml /opt/mini580/prod/docker-compose.yml
sudo cp /chemin/repo/deploy/nginx/*.conf /opt/mini580/nginx/
sudo cp /opt/mini580/nginx/*.conf /etc/nginx/sites-available/
sudo nginx -t && sudo systemctl reload nginx
sudo -u deploy /opt/mini580/bin/deploy.sh test   # ou prod
```

Backup recommandé : inclure `/opt/mini580/{test,prod}/media` dans les snapshots / rsync Hostinger.

## Commandes utiles sur le VPS

```bash
ssh mini580-test   # ou mini580-prod (même machine)

sudo -u deploy /opt/mini580/bin/deploy.sh test ghcr.io/mini580-baie-de-somme/mini-580:test
sudo -u deploy docker compose -f /opt/mini580/test/docker-compose.yml --env-file /opt/mini580/test/.env logs -f web
sudo -u deploy docker compose -f /opt/mini580/prod/docker-compose.yml --env-file /opt/mini580/prod/.env ps
```

## Fichiers du dépôt

| Chemin | Rôle |
|--------|------|
| `web/Dockerfile` | Image Next.js standalone + Prisma migrate |
| `deploy/docker-compose.test.yml` | Stack TEST |
| `deploy/docker-compose.prod.yml` | Stack PROD |
| `deploy/nginx/*.conf` | Reverse proxy HTTP |
| `deploy/scripts/bootstrap-vps.sh` | Provisionnement serveur (+ dossiers media uid 1001) |
| `deploy/scripts/deploy.sh` | Pull image + compose up (+ assure `./media`) |
| `.github/workflows/deploy-test.yml` | CI TEST |
| `.github/workflows/deploy-prod.yml` | CD PROD manuel |
