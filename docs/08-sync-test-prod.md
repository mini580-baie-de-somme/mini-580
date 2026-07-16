# Sync TEST ↔ PROD

> OTP Ed25519 mutuels · pull PROD→TEST · publish TEST→PROD · archive/delete · jalons timeline

## Principes

| Action | Comportement |
|--------|----------------|
| **Tirer depuis PROD** (sur TEST) | Articles PROD upsert par **même `id`**. Posts TEST-only conservés. |
| **Publier sur PROD** (depuis TEST) | Article ou **jalon** TEST-only → import PROD (même id). |
| **Catalogue** | Tags / Thèmes / Jalons (FR/EN) — pull ou push. |
| **CRUD Jalons** | `/editeur/jalons` — créer / éditer / supprimer, sync PROD↔TEST. |
| **Archiver / Supprimer** | Soft archive ou hard delete. |

## UI (connecté)

| Route | Rôle |
|-------|------|
| Header | **Articles** · **Jalons** · **Sync** |
| `/editeur` | Articles |
| `/editeur/jalons` | CRUD roadmap |
| `/editeur/sync` | Pull / catalogue / divergences |

## API jalons

| Route | Auth | Rôle |
|-------|------|------|
| `GET/POST /api/milestones` | Session (POST) | Liste / créer |
| `PATCH/DELETE /api/milestones/[id]` | Session | Modifier / supprimer |
| `POST /api/sync/publish-milestone-to-prod` | Session (TEST) | Pousse un jalon vers PROD |
| `POST /api/sync/catalog` `{ direction: "pull" }` | Session | Tirer jalons (+ tags/thèmes) depuis peer |

Voir aussi les routes sync articles dans ce même document historique / code `web/src/app/api/sync/`.
