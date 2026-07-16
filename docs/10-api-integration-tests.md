# Suite de tests — Class Mini 5.80

Deux familles distinctes + simulations Telegram.

## 1) Tests locaux (handlers / logique)

Exécutés contre Postgres Docker local (`:5434`), en appelant les **handlers** Next (pas le serveur HTTP public).

```bash
cd web
npm run test:local
```

Couvre :
- CRUD Posts + FR/EN
- CRUD Photos + FR/EN
- édition move/zoom/rotate/crop → **régénère les 4 tailles** (bake)
- CRUD Tags / Themes / Jalons
- Galerie publique (`/api/gallery` — published only + search)
- Sync (OTP peer, apply pull, gardes, jobs async 202/409, peer média + checksum)
- Surface tools IA (catalogue + exercice Bearer)

Depuis un container de build/dev (même commandes, DB joignable) :
```bash
docker compose -f docker-compose.test-db.yml up -d --wait
npm run test:db:migrate && npx vitest run --config vitest.config.ts
```

## 2) Tests HTTP réels (env TEST)

Appels `fetch` vers le **vrai serveur** `https://test.classmini580.blog`.

**Obligatoire** (échec net si absent — pas de skip) :
```bash
export TEST_BASE_URL=https://test.classmini580.blog
export TEST_INGEST_API_KEY="…"   # même valeur que sur le VPS TEST
export TEST_ADMIN_PASSWORD="…"   # login éditeur
# optionnel: TEST_ADMIN_EMAIL=admin@classmini580.blog

cd web && npm run test:http
```

Couvre :
- smoke CRUD + auth session
- `GET /api/gallery` + page `/galerie`
- sync status (`activeJob`)
- `POST /api/sync/pull-from-prod` → 202 + poll job (ou 409 si busy)

À étendre : upload photo + bake HTTP, publish-to-prod E2E.

## 3) Simulations conversation Telegram

FSM locale (`processTelegramUpdate`) avec API Telegram mockée.

```bash
cd web && npm run test:telegram
```

Scénarios déjà présents :
- 1 photo + texte + **nouveau tag** + approve FR + `/traduire`
- **plusieurs photos** puis finish
- utilisateur non allowlisté

À étendre : jalon existant vs nouveau, modifier avant valider, ordre photos, meta photo FR/EN, publier vs brouillon.

## Photo — comportement produit

`PATCH /api/posts/:id/images/:imageId` avec crop/zoom/rotate/focus :
1. relit `urlOrigin`
2. applique le transform (sharp)
3. régénère `picto` / `petite` / `moyenne` / `grande`
4. conserve l’origine intacte

Affichage public : variants bakés (pas de double CSS).  
Éditeur : `GalleryImage mode="edit"` (origine + CSS live).
