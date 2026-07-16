# Sync TEST ↔ PROD

> OTP Ed25519 mutuels · pull PROD→TEST · publish TEST→PROD · archive/delete

## Principes

| Action | Comportement |
|--------|----------------|
| **Tirer depuis PROD** (sur TEST) | Pour chaque article PROD : upsert par **même `id`** (écrase tags, thèmes, jalons, images). Les posts présents **seulement sur TEST** sont conservés. |
| **Publier sur PROD** (depuis TEST) | Article TEST-only → import sur PROD (même id) + passage en `PUBLISHED` si demandé. |
| **Catalogue** | Tags / Thèmes / Jalons timeline (FR/EN) — pull ou push peer. |
| **Archiver** | Statut `ARCHIVED` (invisible public). |
| **Supprimer** | Suppression définitive en base. |

Auth croisée : chaque environnement signe un JWT court (`EdDSA` / Ed25519). Le pair vérifie avec la clé publique de l’émetteur.

## Variables d’environnement

```bash
SYNC_ENV=test|prod
SYNC_PEER_URL=https://classmini580.blog   # ou https://test.classmini580.blog
SYNC_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
SYNC_PEER_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
```

Dans les `.env` Docker, les retours à la ligne du PEM sont remplacés par `\n`.

## Génération des clés

```bash
openssl genpkey -algorithm Ed25519 -out sync-test-private.pem
openssl pkey -in sync-test-private.pem -pubout -out sync-test-public.pem

openssl genpkey -algorithm Ed25519 -out sync-prod-private.pem
openssl pkey -in sync-prod-private.pem -pubout -out sync-prod-public.pem
```

- TEST `.env` : `SYNC_PRIVATE_KEY` = contenu test-private · `SYNC_PEER_PUBLIC_KEY` = prod-public  
- PROD `.env` : `SYNC_PRIVATE_KEY` = contenu prod-private · `SYNC_PEER_PUBLIC_KEY` = test-public  

## UI

- `/editeur` — Archiver / Supprimer / Publier PROD (si TEST-only)
- `/editeur/sync` — pull PROD, sync catalogue, liste divergences

## API

| Route | Auth | Rôle |
|-------|------|------|
| `GET /api/sync/peer/export` | OTP Bearer | Export posts / catalog / summaries |
| `PUT /api/sync/peer/import` | OTP Bearer | Import post ou catalog |
| `GET /api/sync/status` | Session | Comparaison local ↔ peer |
| `POST /api/sync/pull-from-prod` | Session (TEST) | Pull articles + catalog |
| `POST /api/sync/publish-to-prod` | Session (TEST) | Pousse un post vers PROD |
| `POST /api/sync/catalog` | Session | `{ direction: "pull"\|"push" }` |
| `POST /api/posts/[id]/archive` | Session | Soft archive |
| `DELETE /api/posts/[id]` | Session | Hard delete |
