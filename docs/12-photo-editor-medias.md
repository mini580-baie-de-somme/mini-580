# Éditeur photo, médiathèque & intégrité stockage

> Spec produit + technique — validée juillet 2026 · stabilisée **v1.2.66** (août 2026)

Couvre l’édition layout des images (article, couverture, médiathèque), le rebake des variants, l’intégrité du bucket local, les URLs virtuelles, le flux upload mobile et le logging de debug.

## Principes

| Règle | Détail |
|-------|--------|
| **Origin locale obligatoire** | `urlOrigin` = chemin `/media/...` présent sur disque. Pas de rebake depuis URL externe ni variante dégradée. |
| **WYSIWYG** | Preview éditeur = pipeline serveur (`computeEditorPhotoLayout` / `applyImageTransform`). |
| **Ratio portrait 3:4** | Cadre crop toujours `width:height = 3:4` ; variants rebake en boîtes fixes (picto → grande). |
| **Crop proportionnel au canvas** | Fenêtre crop en % du stage (inset) — utilise tout l’espace écran ; **ne change pas** les tailles rebake. |
| **Pivot zoom/rotation** | Centre du crop (cadre blanc), pas le centre image. |
| **Reset au remplacement** | Nouvelle originale → `DEFAULT_IMAGE_LAYOUT` (scale 1, rotation 0, offsets 0). |
| **Pas de fallback silencieux** | Origin absente → erreur claire + audit UI ; pas de fetch Blogger ni rebake depuis `grande`. |
| **Canvas = origin uniquement** | `editorCanvasSrc()` — jamais `urlMoyenne` / `urlGrande` (variants déjà croppés et basse résolution). |
| **Vignettes article = variants** | `galleryThumbSrc()` — picto → petite → moyenne ; **jamais** `urlOrigin`. |
| **Upload mobile fiable** | Multipart via **XHR** + retry ; compression client avant envoi (max 4096 px). |
| **Refresh vignette post-save** | Poll rebake async jusqu’à rotation des URLs variants ; baseline = **réponse PATCH** (pas le draft pre-save). |

## Modèle layout (`ImageLayoutParams`)

Fichier canonique : `web/src/lib/image-layout.ts`

| Champ | Rôle |
|-------|------|
| `offsetX`, `offsetY` | Décalage du centre photo vs centre crop, en unités **largeur crop** (−2…2) |
| `scaleX`, `scaleY` | Échelle uniforme relative au « cover crop » (1 ≈ couvre le crop) |
| `rotation` | Degrés libres |
| `lockAspect` | Verrouille scaleX = scaleY |
| `cropShape` | `RECT` ou `CIRCLE` |
| `cropInset` | Marge intérieure 0–0.4 (rétrécit le crop dans le stage) |
| `backgroundColor` | Couleur fond ou `transparent` |

Champs legacy (`zoom`, `focusX`, `focusY`, `cropX`…) fusionnés à la lecture ; écriture sync legacy + nouveaux champs.

### Variants rebake (fixes)

| Variant | Pixels | Usage |
|---------|--------|-------|
| picto | 96×128 | Vignettes article |
| petite | 288×384 | Référence layout / mobile |
| moyenne | 576×768 | Galerie |
| grande | 1080×1440 | Plein écran / diaporama |

Rebake : `web/src/lib/media-variants.ts` (sharp) — rotation → cover-scale → crop fenêtre → masque cercle si `CIRCLE`.

### Crop circulaire

Preview et serveur : cercle **inscrit** dans le rectangle crop (`cropCircleMetrics` — `r = min(w,h)/2`).  
Interdit : `border-radius: 50%` sur un rectangle 3:4 (produit une ellipse).

### Zoom avec pivot crop

À chaque changement d’échelle (pinch, boutons ±, molette) :

```
offset_new = offset_old × (scale_new / scale_old)
```

(`offsetForScalePivot` — évite la dérive quand la photo est déjà décalée.)

## UI éditeur

### Composants

| Composant | Rôle |
|-----------|------|
| `PhotoEditModal` | Modal fullscreen — métadonnées FR/EN, date, actions save |
| `PhotoCanvasEditor` | Stage + gestures + barre flottante mobile |
| `EditorSheetPanel` | Panneau bas mobile (repliable ~2/5 hauteur, poignée drag) |
| `MediaIntegrityNotice` | Blocage + URLs externes cliquables |
| `MediaClipboardPasteButton` | Coller image blob (mobile) |

### Mobile (<768px)

- **1 doigt** : pan (déplacer photo dans le crop)
- **Pincement 2 doigts** : zoom + rotation (aspect lock)
- **Barre flottante** sur le canvas : `−` `+` `↺` `↻` (44px)
- **Panneau bas** : Mise en page (X/Y, Éch., rotation, crop, fond) puis titres/descriptions scrollables
- **Poignée** : replier/agrandir le panneau pour libérer le canvas

Desktop : sidebar fixe à droite, mêmes gestures souris (molette zoom, drag pan).

### Remplacement / collage

- **Remplacer le fichier** : upload ou choix fichier — reset layout complet
- **Coller** (toujours visible à côté de Remplacer) : `navigator.clipboard.read()` — **image blob uniquement** ; URLs/texte refusés avec message explicite
- Après save : vérif `urlOrigin` commence par `/media/`

### Date média

Texte d’aide sous le champ : *« Permet de dater le média pour l’ordre dans la galerie. »*

## Intégrité stockage

Fichiers : `web/src/lib/media-integrity.ts` (serveur), `media-integrity-shared.ts` (client+serveur), `media-integrity-types.ts`.

### Codes issue

| Code | Signification |
|------|---------------|
| `REMOTE_ORIGIN` | `urlOrigin` = URL http(s) externe |
| `ORIGIN_NOT_LOCAL` | Chemin non `/media/...` |
| `ORIGIN_MISSING` | Clé `/media/...` absente du disque |
| `VARIANT_NOT_LOCAL` | Variante non locale |
| `VARIANT_MISSING` | Fichier variante absent |

### Résultat `MediaIntegrity`

- `ok` : tous fichiers requis présents
- `editable` : origin locale existe → éditeur layout autorisé
- `externalUrls` : URLs http(s) en base (audit — liens cliquables UI)
- `messages` : détail i18n (`media.integrity.*`)

### Garde-fous API

- PATCH layout / rebake : origin locale requise → **422** `MediaIntegrityError` si non conforme
- Création média JSON : `urlOrigin` http(s) **refusé**
- Logs rebake : canal `[media-trace]` + `traceId` (`mt-*`)

### UI audit

- **Médiathèque** : colonne **Stockage** — badge `Local OK` / `Non conforme` + liens externes
- **Avant édition** : panneau ambre si `!editable` — message + URL(s) cliquable(s) + Remplacer / Coller
- Pas de canvas layout tant que origin non locale

## URLs virtuelles (SPA + back navigateur)

Fichiers : `web/src/lib/virtual-url.ts`, `web/src/hooks/useVirtualUrl.ts`.

**Règle agent :** toute nouvelle modale/overlay doit pousser l’historique (`pushVirtual`) et fermer via `closeVirtual` / `history.back()`.

### Paramètres

| Route | Param | État |
|-------|-------|------|
| `/editeur/[id]` | `?photo=new` | Ajouter photo |
| | `?photo=<id>` | Éditer photo |
| | `?photo=<id>&cover=1` | Éditer couverture |
| | `?cover=1` | Ajouter couverture |
| | `?library=1` | Picker médiathèque |
| `/editeur/galerie` | `?media=new` | Créer média |
| | `?media=<id>` | Éditer (deep link) |
| `/galerie` | `?view=<photoId>` | Diaporama / lightbox |

Filtres existants (`search`, `kind`, …) conservés à l’ouverture/fermeture.

Tests : `web/src/test/local/virtual-url.test.ts`

## Logging structuré

Module : `web/src/lib/app-log.ts`

### Niveaux

`trace` < `debug` < `info` < `warn` < `error`

### Par environnement

| Env | Variable | Défaut |
|-----|----------|--------|
| Dev local | `LOG_LEVEL` / `NEXT_PUBLIC_LOG_LEVEL` | `debug` |
| TEST | idem | `debug` |
| PROD | idem | `warn` |

Détection PROD : `SYNC_ENV=prod` ou `SITE_URL` sans `test`.

### Canaux

| Canal | Où | Contenu |
|-------|-----|---------|
| `[media-trace]` | Serveur (rebake, resolve origin, save) | `traceId`, layout, URLs variants |
| `[photo-editor-trace]` | Client (save flow) | patch start/fail, body erreur |

Erreur save : bannière avec `detail` + `traceId` serveur (ex. `Origin fetch failed` → remplacé par erreur intégrité stricte).

## Flux save / rebake

### Nouveau média (« Ajouter un média »)

Tant que le POST ne passe pas, **rien n’est en base** (`draft.id` vide, preview locale `URL.createObjectURL`).

1. **Prepare** — `prepareImageForUpload(pendingFile)` (downscale max 4096 px, JPEG 92 %, skip si &lt; 2 Mo)
2. **Upload** — `POST /api/posts/:id/media` via `uploadFormDataWithRetry` (XHR, 4 retries, timeout 120 s)
   - `createMediaFromUpload` → `storeOriginAndVariants` (origin + 4 variants layout default) → insert Prisma
3. **Patch layout** — `PATCH /api/posts/:id/images/:imageId` avec cadrage
4. Rebake async si layout modifié → poll client (voir ci-dessous)

Échec upload côté navigateur (`Failed to fetch`) = abort **avant** le serveur — zéro trace nginx ; logs client `[photo-editor-trace]` `save.upload.start` / `save.error`.

### Édition layout (média existant)

1. Client PATCH layout (+ meta) → API
2. Persist DB (layout + champs legacy sync)
3. Rebake depuis **origin locale** + layout persisté (sync ou async selon `layout-rebake-schedule.ts`)
4. Réponse PATCH inclut `rebakePending: boolean` + URLs variants **courantes**
5. Échec rebake → **500** JSON `{ traceId, detail, step }` (plus de faux succès)
6. Sync `coverImageUrl` / variantes si article couverture
7. Client ferme la modal + `onSaved(saved)` immédiat avec layout persisté
8. **Poll rebake** (async, non bloquant) :
   - Baseline = `mediaVariantSnapshot(patchResponse)` — **pas** le draft pre-save ni les URLs post-upload intermédiaires
   - `waitForMediaRebakeAfterPatch(mediaId, baseline, { maxMs: 20_000 })`
   - Détecte rotation sur picto / petite / moyenne / grande
   - Timeout → `fetchMediaAfterRebakeTimeout` (dernier recours)
   - Succès → second `onSaved` avec variants à jour + `galleryThumbCacheBust()` pour remount `<img>`

### Remplacement fichier (`POST …/replace`)

- Stocke **origin seule** ; variants mis à `null` (pas de rebake intermédiaire avec l’ancien layout)
- PATCH suivant rebake avec le layout de la modal
- Évite le bug « poll s’arrête sur variant intermédiaire au mauvais cadrage »

Routes :  
- `PATCH /api/posts/:id/images/:imageId`  
- `PATCH /api/media-library/:id`  
- `POST /api/media-library/:id/replace` — remplacement origin ; variants rebakés au PATCH layout

## Upload client (mobile / Chrome)

Fichiers : `web/src/lib/prepare-upload-image.ts`, `web/src/lib/upload-form-data.ts`, `web/src/lib/fetch-with-network-retry.ts`.

| Étape | Détail |
|-------|--------|
| Compression | `ORIGIN_UPLOAD_MAX_DIMENSION = 4096` — rebake Sharp lit ce fichier ; plus de plafond 1600 px mobile |
| WYSIWYG upload | Preview locale = fichier **après** `prepareImageForUpload` (même bytes que l’envoi) |
| Transport | **XHR** `uploadFormData` (plus fiable que `fetch`+FormData sur gros multipart mobile) |
| Retry upload | `uploadFormDataWithRetry` — 4 tentatives, backoff 600 ms × attempt ; FormData reconstruit à chaque essai |
| Retry PATCH | `fetchWithNetworkRetry` — 4 tentatives |
| Erreur réseau | `isNetworkFetchError` — `Failed to fetch`, `Load failed`, abort XHR |

**Cause incident août 2026 :** pool connexions Chrome (~6/host) saturé par les `keepalive` autosave article pendant modal ouverte + upload sans retry → abort client, message « Connexion interrompue ».

## Sources d’image éditeur vs vignettes

| Usage | Fonction | Source autorisée |
|-------|----------|------------------|
| Canvas édition (move/rotate/crop) | `editorCanvasSrc()` | `localPreviewUrl` (pending) ou `urlOrigin` cache-busté |
| Panneau latéral preview | idem | **origin uniquement** (depuis v1.2.66) |
| Vignette bandeau article | `galleryThumbSrc()` | picto → petite → moyenne (+ cache-bust layout) |
| Affichage public galerie | `GalleryImage` / `imageSrc()` | variants rebakés, pas origin plein cadre |

Refresh origin à l’ouverture modal edit : `GET /api/media-library/[id]` si besoin.

## Article — bandeau pictos & galerie publique (Phase 1d)

**Éditeur** (inchangé v1.2.x) :

- Pictos médias standalone : `flex-wrap` (pas de scroll horizontal page)
- Boutons réordonnancement ← → agrandis (36px touch target)

**Public / preview** (Phase 1d — `docs/13-article-image-groups.md`) :

- Bandeau bas de page + bouton diaporama alimentés par le **manifeste médias unifié** (plus seulement `PostMedia`)
- Ordre manifeste : couverture → groupes inline (ordre placeholders dans body locale) → standalone `PostMedia`
- Dedupe par `mediaId` (première occurrence gagne)
- Lightbox / diaporama : composant existant **`MediaSlideshow`** — partagé avec mosaïques inline

## Description site (footer / metadata)

> Class Mini 5.80 baie de Somme. Blog bilingue de construction de trois Class Globe 5.80 en baie de Somme.

## Fichiers de référence

| Sujet | Fichier |
|-------|---------|
| Layout + crop | `web/src/lib/image-layout.ts` |
| Gestures touch | `web/src/lib/photo-gestures.ts` |
| Rebake sharp | `web/src/lib/media-variants.ts` |
| Intégrité | `web/src/lib/media-integrity*.ts` |
| URLs virtuelles | `web/src/lib/virtual-url.ts` |
| Logging | `web/src/lib/app-log.ts` |
| Clipboard | `web/src/lib/media-file-client.ts` |
| Canvas src / thumbs | `web/src/lib/gallery-editor.ts` |
| Poll rebake client | `web/src/lib/wait-for-media-rebake.ts` |
| Upload prepare | `web/src/lib/prepare-upload-image.ts` |
| Upload XHR + retry | `web/src/lib/upload-form-data.ts` |
| Fetch retry | `web/src/lib/fetch-with-network-retry.ts` |
| Schedule rebake async | `web/src/lib/layout-rebake-schedule.ts` |
| Canvas | `web/src/components/PhotoCanvasEditor.tsx` |
| Modal save flow | `web/src/components/PhotoEditModal.tsx` |

## Historique correctifs (v1.2.58 → v1.2.66)

| Version | Problème | Fix |
|---------|----------|-----|
| **1.2.58** | Upload mobile abort (`Failed to fetch`) — Chrome + Safari | XHR multipart, retry upload/PATCH, message erreur explicite |
| **1.2.60** | Vignette article stale après crop | Poll rebake inclut `urlPetite` ; cache-bust thumb ; remount `<img>` |
| **1.2.61** | Édition sur variant dégradé ; origin mobile 1600 px | `editorCanvasSrc()` origin-only ; upload max 4096 px ; preview WYSIWYG |
| **1.2.66** | Refresh + résolution toujours KO | Poll baseline = réponse PATCH ; replace sans rebake intermédiaire ; panneau latéral origin |

**Médias legacy :** photos uploadées avant v1.2.61 (origin ~1600 px) ou collage clipboard — **Remplacer le fichier** avec l’original pour regagner la pleine résolution.

## Checklist nouvelle modale / overlay

- [ ] Parse + serialize dans `virtual-url.ts`
- [ ] Tests dans `virtual-url.test.ts`
- [ ] `useVirtualUrl` : `pushVirtual` à l’ouverture, `closeVirtual` à la fermeture
- [ ] Conserver query params métier existants
- [ ] Logs `trace`/`debug` sur chemins critiques si save/upload
