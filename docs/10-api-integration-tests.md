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
- CRUD Photos + FR/EN + layout (`ImageLayoutParams`, legacy merge)
- édition move/zoom/rotate/crop → **régénère les 4 tailles** (rebake sharp, origin locale requise)
- **Intégrité media** (`assessMediaIntegrity`, codes `REMOTE_ORIGIN`, `ORIGIN_MISSING`, …)
- **Gestures mobile** (`photo-gestures` — pan, pinch zoom/rotation, pivot crop)
- **Layout preview** (`image-layout`, `computeEditorPhotoLayout`, crop circulaire WYSIWYG)
- **URLs virtuelles** (`virtual-url`, modales éditeur/galerie)
- **Logging** (`app-log`, niveaux par env)
- **Clipboard** (`media-clipboard`, blob image uniquement)
- **Versioning build** (`build-version`, `build-counter.json`)
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

Scénarios (`npm run test:telegram` — **7/7**) :

| Scénario | Couverture |
|----------|------------|
| User non allowlisté | rejet |
| 1 photo + **nouveau tag** + edit FR + `/traduire` retardé | |
| **Tag + jalon existants** | binding catalogue |
| **Plusieurs photos** → reorder → meta FR/EN → **brouillon** | |
| Parcours complet → **publier** | |
| Jalon ajouté plus tard (edit REVIEW_FR) | |
| `/statut` + `/annuler` | |

Sans `CURSOR_API_KEY` : les tests Telegram/IA **échouent** (clé obligatoire).

### D’où vient la clé (jamais dans git)

```
GitHub Secret CURSOR_API_KEY
        │
        ├─► Actions workflow « Tests » (env injecté automatiquement)
        │
        └─► Deploy TEST/PROD → /opt/mini580/{test,prod}/.env
                 │
                 └─► local (optionnel) :
                     cd web && npm run test:cursor:sync
                     # → web/.env.cursor.local (gitignoré)
```

Mettre / mettre à jour le secret :
```bash
gh secret set CURSOR_API_KEY --repo mini580-baie-de-somme/mini-580
gh secret set CURSOR_MODEL --body "composer-2.5" --repo mini580-baie-de-somme/mini-580
```

CI : push/PR sur `web/**` → workflow [Tests](../.github/workflows/test.yml).

## Photo — comportement produit

Spec complète : **`docs/12-photo-editor-medias.md`**

### Layout & rebake

`PATCH /api/posts/:id/images/:imageId` (ou médiathèque) avec layout :
1. Vérif intégrité — origin **locale** `/media/...` sur disque (sinon 422)
2. Persist layout + sync champs legacy (`zoom`, `focusX`, …)
3. Rebake depuis origin + layout sauvé (sharp)
4. Régénère `picto` / `petite` / `moyenne` / `grande` (boîtes 3:4 fixes)
5. Échec rebake → 500 JSON `{ traceId, detail, step }`

### Preview éditeur

- Crop **proportionnel au canvas** (ratio 3:4) — inset slider
- Zoom/rotation pivot **centre crop** (`offsetForScalePivot`)
- Crop **CIRCLE** : cercle inscrit (pas ellipse CSS)
- Remplacement originale → reset `DEFAULT_IMAGE_LAYOUT`

### Affichage public

Variants rebakés (pas de double CSS). Galerie / diaporama : ratio 3:4 ou cercle selon `cropShape`.

### Tests locaux dédiés (25 fichiers)

| Fichier | Sujet |
|---------|-------|
| `image-layout.test.ts` | Layout, crop window, pivot scale, cercle |
| `photo-gestures.test.ts` | Pinch, pan, rotation |
| `virtual-url.test.ts` | Query params modales |
| `media-integrity*.test.ts` | Codes issue, URLs externes |
| `media-clipboard.test.ts` | Coller blob |
| `app-log.test.ts` | Niveaux log |
| `build-version.test.ts` | Semver + compteur |
| `photos.test.ts` / `media-library.test.ts` | CRUD + rebake |
