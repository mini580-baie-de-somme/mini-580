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

| Secret | Valeur |
|--------|--------|
| `DEPLOY_HOST` | `2.24.13.70` |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_SSH_KEY` | Contenu de la clé privée CI (`~/.ssh/id_ed25519_mini580_ci`) |

Le push d’images GHCR utilise `GITHUB_TOKEN` (permissions `packages: write` dans les workflows).

### Token GHCR read sur le VPS (si le package est privé)

1. GitHub → Settings → Developer settings → Personal access token (classic) avec `read:packages`
2. Sur le VPS : `echo 'TOKEN' | sudo tee /opt/mini580/.ghcr-token && sudo chmod 600 /opt/mini580/.ghcr-token && sudo chown deploy:deploy /opt/mini580/.ghcr-token`
3. `export GHCR_USER=smramdani` (ou le user GitHub propriétaire du token) — ou ajouter `GHCR_USER=...` dans le cron/profile de `deploy`

Astuce : rendre le package GHCR **public** (Package settings) pour simplifier les pulls.

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
gh secret set DEPLOY_HOST --body "2.24.13.70" --repo mini580-baie-de-somme/mini-580
gh secret set DEPLOY_USER --body "deploy" --repo mini580-baie-de-somme/mini-580
gh secret set DEPLOY_SSH_KEY < ~/.ssh/id_ed25519_mini580_ci --repo mini580-baie-de-somme/mini-580
```

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
| `deploy/scripts/bootstrap-vps.sh` | Provisionnement serveur |
| `deploy/scripts/deploy.sh` | Pull image + compose up |
| `.github/workflows/deploy-test.yml` | CI TEST |
| `.github/workflows/deploy-prod.yml` | CD PROD manuel |
