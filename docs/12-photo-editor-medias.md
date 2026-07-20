# Éditeur photo, médiathèque & intégrité stockage

> Spec produit + technique — validée juillet 2026 (v1.2.x)

Couvre l’édition layout des images (article, couverture, médiathèque), le rebake des variants, l’intégrité du bucket local, les URLs virtuelles et le logging de debug.

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

1. Client PATCH layout (+ meta) → API
2. Persist DB (layout + champs legacy sync)
3. Rebake depuis **origin locale** + layout persisté
4. Échec rebake → **500** JSON `{ traceId, detail, step }` (plus de faux succès)
5. Sync `coverImageUrl` / variantes si article couverture
6. Client conserve layout sauvé (pas de reset au remapping)

Routes :  
- `PATCH /api/posts/:id/images/:imageId`  
- `PATCH /api/media-library/:id`  
- `POST …/replace` — remplacement fichier + reset layout

## Article — bandeau pictos

- Pictos médias : `flex-wrap` (pas de scroll horizontal page)
- Boutons réordonnancement ← → agrandis (36px touch target)

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
| Canvas | `web/src/components/PhotoCanvasEditor.tsx` |
| Modal | `web/src/components/PhotoEditModal.tsx` |

## Checklist nouvelle modale / overlay

- [ ] Parse + serialize dans `virtual-url.ts`
- [ ] Tests dans `virtual-url.test.ts`
- [ ] `useVirtualUrl` : `pushVirtual` à l’ouverture, `closeVirtual` à la fermeture
- [ ] Conserver query params métier existants
- [ ] Logs `trace`/`debug` sur chemins critiques si save/upload
