# Class Mini 5.80 Baie de Somme

Plateforme de documentation, publication et communication autour de la construction de **trois Class Globe 5.80** sur la Baie de Somme.

**Stack :** Next.js 15 + PostgreSQL + **OpenClaw** (control plane, VM dédiée Phase 2) + **Telegram** / **Google Drive** (canaux équipe zero-tech).

## Le projet

Trois amis — **Laurent**, **Marco** et **Rodolphe** — construisent chacun leur voilier Class Globe 5.80 (coques **#268**, **#269** et **#270**) à **Class Mini 5.80 Baie de Somme**, une grange de 250 m² près de la baie.

Ce dépôt part de zéro pour reconstruire le site web, la documentation et la communication à partir du blog existant [cg268269270.blogspot.com](https://cg268269270.blogspot.com/).

## Deux couches

| Rôle | Interface | Objectif |
|------|-----------|----------|
| **Admin / Webmaster** (vous) | OpenClaw + Telegram DM + Control UI | Concevoir, administrer, valider, déployer |
| **Équipe chantier** | Groupe Telegram + Google Drive | Publier photos, articles, plans — zéro technique |

## Documentation

| Document | Contenu |
|----------|---------|
| [Contexte Class Globe 5.80](docs/01-contexte-class-globe-580.md) | Classe, règles, communauté mondiale, courses |
| [Projet Class Mini 5.80 Baie de Somme](docs/02-projet-mini580.md) | Équipe, chantier, rôles, état d'avancement |
| [Blog existant](docs/03-blog-existant.md) | Inventaire du contenu à migrer |
| [Objectifs & vision](docs/04-objectifs-vision.md) | Vision validée, décisions, prochaines étapes |
| [Architecture OpenClaw](docs/05-architecture-openclaw.md) | Schéma technique, pipeline publication, skills |
| [Spec technique site](docs/06-spec-technique.md) | Décisions validées, modèle DB, phasage |
| [Déploiement & CI/CD](docs/07-deploy-cicd.md) | VPS Hostinger, Docker, TEST/PROD, GitHub Actions |
| [Sync TEST ↔ PROD](docs/08-sync-test-prod.md) | OTP Ed25519, pull/publish, archive |
| [Publication Telegram + IA](docs/09-telegram-publish.md) | Bot allowlist, review FR/EN, photos, preview |
| [Tests d'intégration API](docs/10-api-integration-tests.md) | Vitest CRUD / photos / sync / tools IA |
| [Design system listes éditeur](docs/11-design-system-editeur.md) | Recherche, actions, clic ligne, infinite scroll, compteurs, médiathèque |
| [Éditeur photo & médiathèque](docs/12-photo-editor-medias.md) | Layout mobile, intégrité stockage, rebake, URLs virtuelles, logging |

## Application web (`web/`)

```bash
cp web/.env.example web/.env
./scripts/dev.sh    # PostgreSQL + migrate + seed + Next.js :3002
```

- **Login dev :** `admin@classmini580.blog` / `changeme123`
- Pages : `/` · `/blog` · `/galerie` · `/timeline` · `/connexion` · `/editeur`
- Médias : bucket local S3-like (`/media/...`) — origin + variants rebake ; éditeur photo mobile (pan/pinch, crop 3:4) ; audit intégrité ; collage clipboard
- **Galerie publique :** `/galerie` — filtres date/jalon/tags/thèmes + diaporama (`?view=` deep link)
- **Prod :** [classmini580.blog](https://classmini580.blog) · **Test :** [test.classmini580.blog](https://test.classmini580.blog) — version `GET /api/version` (schéma `major.minor.patch`, compteur CI)
- **CI/CD :** push `main` → build TEST · Deploy PROD = promotion `:vX.Y.Z` immuable (zéro rebuild) · voir `docs/07-deploy-cicd.md`
- **Tests :** `npm run test:local` · `test:http` · `test:telegram` · sync clé locale `npm run test:cursor:sync` (depuis VPS, gitignoré)
- **Secrets :** `CURSOR_*` (repo) + Telegram/sync/DB (environments) — jamais dans git
## Liens utiles

- [Class Globe 5.80 — site officiel](https://classglobe580.com/)
- [Builders Blogs officiels](https://classglobe580.com/builders-blogs/)
- [Globe 5.80 Transat](https://globe580transat.com/)
- [Mini Globe Race](https://minigloberace.com/)
- [Kit France — kit-bateau.fr](https://www.kit-bateau.fr/produit/kit-class-globe-5-80/)
- [Blog actuel Class Mini 5.80 Baie de Somme](https://cg268269270.blogspot.com/)

## Prochaines étapes

1. ~~Valider l'architecture OpenClaw~~ → spec validée (`docs/06-spec-technique.md`)
2. ~~Lancer le squelette du site web~~ → Phase 1a/1b/1c en place (`web/`)
3. ~~Provisionner VPS Hostinger + domaine + CI/CD~~ → TEST/PROD live, promotion package (`docs/07-deploy-cicd.md`)
4. ~~Éditeur photo mobile + intégrité media + rebake strict~~ → v1.2.x (`docs/12-photo-editor-medias.md`)
5. Migrer médias Blogger non conformes (re-upload originale locale)
6. Installer OpenClaw sur VM dédiée + bot Telegram Class Mini 5.80 Baie de Somme (Phase 2)
7. ~~Développer le skill `mini580-ingest`~~ → webhook + FSM review (`docs/09-telegram-publish.md`)
8. Brancher `TELEGRAM_*` + `CURSOR_API_KEY` sur TEST et valider un post bout-en-bout équipe
9. Enrichir contenu équipe + jalons
