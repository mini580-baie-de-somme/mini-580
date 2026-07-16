# Spec technique — Site Mini5.80 Baie de Somme

> Validée par Hammed — 15 juillet 2026

## Décisions validées

| Sujet | Décision |
|-------|----------|
| Base de données | **PostgreSQL** — source de vérité unique |
| Dev local | PostgreSQL local + Node (port 3002, slot 02 Simohra) derrière nginx :8002 |
| Prod | VPS Hostinger `2.24.13.70` — Docker Compose (TEST + PROD isolés) |
| Domaine | **classmini580.blog** (PROD) · **test.classmini580.blog** (TEST) |
| Tags | Table enrichissable — ajout libre à la volée |
| Jalons | Gestion libre, positionnables par date |
| Statuts article | `draft` · `published` |
| Édition | Tous les users connectés ont les mêmes droits (pas de RBAC) |
| Consultation | Publique (articles publiés) |
| Auth | Login requis pour éditer |
| Langues | FR + EN par article |
| Autosave | Oui (~500 ms debounce) |
| Prévisualisation | Oui (`/apercu/[id]`) |
| Telegram | Channel dédié Mini5.80 Baie de Somme — VM OpenClaw séparée (Phase 2) |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Public (lecture)                                       │
│  / · /blog · /timeline · /blog/[slug]                   │
└─────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────────────────────────────────────┐
│  Éditeurs connectés (mêmes droits pour tous)            │
│  /connexion · /editeur · /editeur/[id] · /apercu/[id]   │
└─────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────────────────────────────────────┐
│  API Next.js (App Router)                               │
│  /api/posts · /api/tags · /api/milestones · /api/auth   │
└─────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────────────────────────────────────┐
│  PostgreSQL                                             │
│  posts · tags · themes · milestones · users · images    │
└─────────────────────────────────────────────────────────┘

Phase 2 (VM dédiée) :
  Telegram Mini5.80 Baie de Somme → OpenClaw → même API/DB (pas cette instance Simohra)
```

## Modèle de données

### Post
- Bilingue : `titleFr/En`, `excerptFr/En`, `bodyFr/En`
- `status` : DRAFT | PUBLISHED
- `slug`, `coverImageUrl`, `publishedAt`
- Relations : hulls (268/269/270), tags, themes, milestone optionnel, images

### Tag (enrichissable)
- `slug` unique, `labelFr`, `labelEn`
- Création libre depuis l'éditeur ou l'API

### Theme (structuré)
- `fournisseurs`, `chantier`, `3d`, `course` (+ extensible)

### Milestone (jalon)
- `titleFr/En`, `descriptionFr/En`, `milestoneDate`, `sortOrder`
- Gestion libre — positionné par date sur `/timeline`

### User
- Email + mot de passe (bcrypt)
- Allowlist `EDITORS_ALLOWLIST` dans `.env`

## Pages

| Route | Accès | Description |
|-------|-------|-------------|
| `/` | Public | Accueil projet, équipe, 3 coques, derniers articles |
| `/blog` | Public | Grille cartes, filtres coque/thème/tag/recherche |
| `/timeline` | Public | Axe vertical jalons + posts accrochés |
| `/blog/[slug]` | Public | Article complet, toggle FR/EN, galerie |
| `/connexion` | Public | Login éditeurs |
| `/editeur` | Auth | Liste brouillons + publiés |
| `/editeur/nouveau` | Auth | Créer article |
| `/editeur/[id]` | Auth | Édition + autosave + publier |
| `/apercu/[id]` | Auth | Prévisualisation brouillon |

## Stack

- **Next.js 15** App Router, TypeScript, Tailwind CSS v4
- **Prisma 7** + `@prisma/adapter-pg`
- **Auth** : JWT httpOnly cookie (jose) + bcrypt
- **Style** : Inter, palette maritime (inspiré driftingdonkey.ch)

## Dev local

```bash
cp web/.env.example web/.env
./scripts/dev.sh          # postgres → migrate → seed → next dev :3002
```

Login seed : `admin@mini580.local` / `changeme123`

nginx (optionnel) :
```bash
# /etc/hosts : 127.0.0.1 mini-580.local
sudo ln -sf .../nginx/mini-580.local.conf /etc/nginx/sites-enabled/
```

## Prod / TEST (CI/CD)

Voir **[Déploiement & CI/CD](07-deploy-cicd.md)** :

1. ~~VM Hostinger + domaine~~ → `2.24.13.70` / `classmini580.blog`
2. Docker Compose (stacks isolées) + nginx + Certbot
3. GitHub Actions : push `main` → TEST · `workflow_dispatch` → PROD
4. Images GHCR `ghcr.io/mini580-baie-de-somme/mini-580`
5. Phase 2 : VM OpenClaw séparée + bot Telegram Mini5.80 Baie de Somme → API posts

## Phasage

| Phase | Contenu | Statut |
|-------|---------|--------|
| **1a** | Site public + DB + seed 3 articles + jalons | ✅ Livré |
| **1b** | Auth + éditeur + autosave + preview | ✅ Livré |
| **2** | VM OpenClaw Mini5.80 Baie de Somme + Telegram publish | À faire |
| **3** | Google Drive, newsletter, commentaires | À faire |

## Contenu seed

- 3 articles Blogger migrés (personnages, chantier, fournisseurs)
- 14 jalons (pré-chantier + étapes classe obligatoires)
- 4 thèmes + tags initiaux
