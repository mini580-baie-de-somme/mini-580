# Groupes de médias inline — articles

> Spec **validée** — août 2026 · **Phase 1d** (prête pour implémentation)

## Problème actuel

Les médias d’un article sont affichés en **une seule galerie en bas** (`ArticleView`), alimentée uniquement par `PostMedia`. Impossible d’insérer des blocs photo/vidéo/doc à des endroits précis du récit.

## Objectif

Créer des **groupes de médias** réutilisables (médiathèque), les **insérer** à différents endroits dans le corps FR/EN d’un ou plusieurs articles, avec rendu public cohérent et **une galerie unifiée** (bandeau + diaporama) couvrant **tous** les médias de l’article.

## Décisions validées (Hammed — 2026-08-13)

| Sujet | Décision |
|-------|----------|
| FR / EN | **Même groupe**, mêmes médias ; titres/descriptions médias bilingues (`Media.titleFr/En`, `descriptionFr/En`) |
| Création | **Médiathèque / galerie éditeur** — pas scoped à un article |
| Média ↔ groupe | **M:N** — un média peut appartenir à 0..N groupes |
| Ordre | **`sortOrder` par membre** — ordre dans le groupe compte |
| Édition | Depuis **médiathèque** ou depuis **l’article** qui référence le groupe |
| Groupe ↔ article | **0..N articles** — un groupe peut exister sans article |
| Suppression | **Interdite** si le groupe est référencé dans au moins un `bodyFr` ou `bodyEn` |
| SEO | **Historique de slugs** pour articles, médias et groupes → redirections 301 |
| Placeholder body | **Jamais tapé à la main** — insertion 100 % assistée (UI + agent Telegram) |
| **Médias inline vs PostMedia** | Un groupe inline **peut** contenir des médias **non** présents dans `PostMedia` — pas d’auto-attach obligatoire |
| **Galerie article (bandeau + diaporama)** | **Évoluée** pour afficher **tous** les médias de l’article via un **manifeste unifié** (voir ci-dessous) — remplace le modèle « bandeau PostMedia seulement » |
| **Affichage inline** | **Mini mosaïque** selon le nombre de médias ; clic → **même** lightbox/diaporama que la galerie article (`MediaSlideshow`) |
| **Widget lightbox** | **Étendre et réutiliser** `MediaSlideshow` / hook `useMediaSlideshow` — **ne pas** créer un second lightbox |
| **Navigation médiathèque** | **Pas d’onglet ni route dédiée** « Groupes » — tout reste dans `/editeur/galerie` : chips d’appartenance sur chaque média, filtre par groupe, action **« Nouveau groupe »** |

## Modèle de données

### Entité indépendante `MediaGroup` (médiathèque)

| Champ | Type | Rôle |
|-------|------|------|
| `id` | cuid | PK stable (référence dans les bodies) |
| `slug` | string @unique | Identifiant URL / lisible opérateur |
| `titleFr` / `titleEn` | string | Titre optionnel du bloc (légende groupe) |
| `layout` | enum | `grid` \| `row` \| `single` (extensible — voir mosaïque publique ci-dessous) |
| `createdAt` / `updatedAt` | DateTime | Audit |

**Table `MediaGroupMember`**

| Champ | Type | Rôle |
|-------|------|------|
| `groupId` | FK MediaGroup | Groupe |
| `mediaId` | FK Media | Média (IMAGE \| DOCUMENT \| VIDEO) |
| `sortOrder` | int | Ordre dans le groupe |

Contrainte : `@@id([groupId, mediaId])` · index `(groupId, sortOrder)`.

**Pas de FK `postId` sur le groupe** — la liaison article ↔ groupe se fait uniquement via le placeholder dans le body (+ scan pour garde-fou suppression).

### PostMedia — sémantique Phase 1d

`PostMedia` devient la table des **pièces jointes standalone** attachées explicitement à l’article (couverture incluse via `isCover`), **sans** exiger que les médias des groupes inline y figurent.

| Rôle | Détail |
|------|--------|
| Couverture | `PostMedia.isCover = true` (ou `Post.coverImageUrl` dérivé) — **premier** du manifeste |
| Standalone | Médias attachés via médiathèque / upload article, **absents** de tout groupe inline référencé dans le body |
| Ordre standalone | `PostMedia.sortOrder` — ordre relatif **entre** standalone uniquement ; position dans le manifeste global = **après** couverture + groupes inline |
| Inline | Médias présents **uniquement** via un groupe inline → **pas** requis dans `PostMedia` pour l’affichage public |

> **Éditeur (info, non bloquant)** : optionnel — badge discret « non attaché au post » sur un média de groupe absent de `PostMedia` (aide opérateur, pas de garde-fou publication).

### Slug history (SEO)

Tables génériques ou dédiées :

| Table | Entité | Déclencheur |
|-------|--------|-------------|
| `PostSlugHistory` | Post | Changement de `Post.slug` (draft resync ou rename explicite futur) |
| `MediaSlugHistory` | Media | Ajout champ `Media.slug` + changement |
| `MediaGroupSlugHistory` | MediaGroup | Changement de `MediaGroup.slug` |

Chaque ligne : `{ entityId, oldSlug, newSlug, changedAt }`. Route publique : lookup slug courant + historique → **301** vers canonique.

> **Note v1** : `Media` n’a pas encore de `slug` — migration Phase 1d ajoute `slug` optionnel (dérivé titre ou id court) pour URLs galerie futures.

### Référence dans le body (`bodyFr` / `bodyEn`)

**Format canonique de stockage** (une ligne seule, parsable) :

```markdown
{{media-group:clxyz123abc}}
```

- `clxyz123abc` = **`MediaGroup.id`** (immuable — pas le slug, pour survivre aux renommages)
- Position dans le body = position de rendu (peut différer entre FR et EN)

**Interdit côté UX** : l’utilisateur ne saisit jamais cette ligne. Insertion via bouton / chip / agent uniquement.

## Manifeste médias unifié (article)

Algorithme canonique pour construire la liste ordonnée **complète** des médias d’un article (bandeau bas de page, bouton diaporama, indices lightbox).

**Entrée** : `post`, `locale` (`fr` | `en`), body = `bodyFr` ou `bodyEn`, `PostMedia[]`, groupes résolus par id.

**Sortie** : `MediaManifestItem[]` — `{ mediaId, media, source: 'cover' | 'inline-group' | 'standalone', groupId?, manifestIndex }` — ordre stable, **sans doublon** par `mediaId`.

### Algorithme

```
manifest = []
seen = Set<mediaId>

1. COUVERTURE
   Si PostMedia avec isCover → ajouter ce média (source: cover)
   Sinon si post.coverImageUrl résolu vers un Media → ajouter (source: cover)
   Marquer mediaId dans seen

2. GROUPES INLINE (ordre document)
   Parser body (locale) → segments text | media-group (ordre d’apparition)
   Pour chaque segment media-group (groupId):
     Charger membres MediaGroupMember triés par sortOrder ASC
     Pour chaque membre:
       Si mediaId ∉ seen → append (source: inline-group, groupId)
       Marquer dans seen
   // first occurrence wins — un média déjà en couverture n’est pas répété

3. STANDALONE PostMedia
   Pour chaque lien PostMedia trié par sortOrder ASC (hors isCover déjà traité):
     Si mediaId ∉ seen → append (source: standalone)
     Marquer dans seen

4. RETOURNER manifest
```

**Règles**

- **Dedupe** : un média présent en couverture **et** dans un groupe inline **et** en standalone n’apparaît **qu’une fois** — **première occurrence** dans l’ordre ci-dessus gagne.
- **Locale body** : pour le public FR, parcourir `bodyFr` ; pour EN, `bodyEn` — positions de groupes peuvent différer entre langues.
- **Bandeau + grille bas de page** : affiche le manifeste complet (pas seulement `PostMedia`).
- **Diaporama** : parcourt le manifeste de l’index 0 à N−1.
- **Lightbox depuis mosaïque inline** : ouvre à l’index du **premier média du groupe cliqué** dans le manifeste global ; swipe / prev-next naviguent sur **tout le manifeste** (recommandé — continuité lecture article). Voir § Widget.

### API

| Route | Rôle |
|-------|------|
| `GET /api/posts/:id/media-manifest?locale=fr\|en` | Manifeste serveur (recommandé — source unique bandeau + body SSR) |
| *(alt.)* client | Même algorithme dans `web/src/lib/article-media-manifest.ts` si données déjà chargées |

Réponse type :

```json
{
  "items": [
    { "mediaId": "…", "source": "cover", "manifestIndex": 0, "media": { … } },
    { "mediaId": "…", "source": "inline-group", "groupId": "…", "manifestIndex": 1, "media": { … } }
  ],
  "total": 12
}
```

## Système de balise — assisté et safe

### Principe

1. **Stockage** = token machine `{{media-group:<id>}}` (robuste, idempotent)
2. **Éditeur visuel (TipTap)** = nœud atomique **bloc non éditable** « Groupe médias »
3. **Affichage opérateur** = chip maritime : `📷 Montage couples · 3 médias` (titre FR + count)
4. **Clic chip** → ouvre éditeur groupe (modal / overlay URL virtuelle `?group=<id>`)
5. **Suppression chip** → retire le placeholder du body (le groupe reste en médiathèque)
6. **Orphan detect** : placeholder sans groupe → bandeau ambre « Groupe introuvable » + bouton retirer

### Insertion (article)

Toolbar corps d’article :

- **« Insérer un groupe »** → picker liste groupes existants + **« Créer… »**
- Curseur TipTap → injecte le nœud bloc au bon endroit
- Même flux FR et EN (même groupe, position libre par langue)
- Insérer un groupe **n’attache pas** automatiquement ses médias à `PostMedia`

### Éditeur groupe (médiathèque ou article)

- Multi-select médias (depuis médiathèque — **pas** limité aux médias déjà attachés au post)
- Réordonnancement drag-and-drop ou ← →
- Titres FR/EN du groupe (optionnel)
- **Autosave debounced ~500 ms** (PATCH idempotent)
- Layout éditeur (`grid` / `row` / `single`) = préférence opérateur ; **rendu public inline** = mosaïque auto (ci-dessous)

### Rendu public — inline (`InlineMediaGroup`)

Parser `article-body.ts` :

1. Split body → segments `text` | `media-group`
2. Pour chaque groupe : composant **`InlineMediaGroup`** — mini mosaïque + légende i18n optionnelle
3. Kinds mixtes : IMAGE en tuiles, DOCUMENT icône+lien, VIDEO player inline ou tuile selon spec composant existant
4. **Clic mosaïque** → `useMediaSlideshow().openViewer(manifestIndex)` où `manifestIndex` = index du **premier** média du groupe dans le manifeste global

Preview `/apercu/[id]` : identique au public.

### Rendu public — bandeau & diaporama (évolution)

Refactor **`ArticleView`** / **`PreviewArticle`** :

- Remplacer `post.images` (= PostMedia seul) par **`buildArticleMediaManifest(...)`**
- Section bas de page « Galerie » : grille / pictos sur **tout le manifeste**
- Bouton « Lancer le diaporama » : `startSlideshow(0)` sur le manifeste
- **`MediaSlideshow`** reçoit `items={manifestItems.map(m => m.media)}` — **un seul** viewer partagé pour bandeau **et** mosaïques inline

## Mosaïque inline — layouts

Rendu **`InlineMediaGroup`** selon `memberCount` (médias du groupe, ordre `sortOrder`). Container : ratio ~16/10, `rounded-lg`, bordure maritime, clic zone entière.

| Count | Layout | Description |
|-------|--------|-------------|
| **1** | Full tile | Une tuile pleine largeur, `object-cover` |
| **2** | Side by side | Grille `1fr 1fr`, gap 2px, hauteur égale |
| **3** | 1 large + 2 small | Colonne gauche ~60 % (1er média), droite empilée (2e + 3e) — variante acceptable : 2+1 horizontal |
| **4+** | 2×2 + overflow | Quatre premières tuiles en grille 2×2 ; si count > 4, badge **« +N »** sur la 4e tuile (N = count − 3 visibles en entier derrière le badge, ou count − 4 selon implémentation — **afficher au minimum 3 vignettes + badge**) |

Règles :

- Toujours utiliser variants rebakés (`galleryThumbSrc` / `imageSrc`) — pas d’origin plein cadre en mosaïque
- DOCUMENT / VIDEO : tuile avec `MediaKindThumb` + label court (comme grille galerie actuelle)
- Accessibilité : `aria-label` du type « Voir N médias — [titre groupe] »
- Hover : légère opacity / ring focus visible (aligné design system)

## Widget — évolution `MediaSlideshow`

**Décision UX lightbox** (recommandée, à implémenter Phase 1d-c) :

| Option | Comportement | Choix |
|--------|--------------|-------|
| A — Manifeste global | Clic mosaïque → index = position du 1er média du groupe dans le manifeste ; prev/next = **tout l’article** | **✅ Retenu** |
| B — Sous-séquence groupe | Lightbox limitée aux médias du groupe seulement | Non retenu (fragmente l’expérience) |

**Implémentation**

- Extraire / enrichir helper : `useArticleMediaSlideshow(manifestItems)` — état `open`, `initialIndex`, `startSlideshow`, `openViewer`, `openAtMediaId`
- **`ArticleView`** : un seul `<MediaSlideshow items={manifest} … />` monté au niveau article ; **`InlineMediaGroup`** reçoit callback `onOpenGroup(groupId)` ou index pré-calculé
- Pas de second composant lightbox — étendre `MediaSlideshow` si besoin (footer légende, compteur « 3 / 12 », kinds mixtes déjà supportés)
- Deep link futur (hors 1d) : `?view=<mediaId>` sur article — même manifeste

Fichiers cibles : `MediaSlideshow.tsx`, `ArticleView.tsx`, `PreviewArticle.tsx`, nouveau `article-media-manifest.ts`, `InlineMediaGroup.tsx`.

## UI — design system

### Médiathèque — groupes intégrés (pas de module séparé)

**Décision validée** : pas d’onglet « Groupes », pas de sous-route `/editeur/galerie/groupes`. Les groupes vivent **dans** la médiathèque existante.

Checklist design system (`docs/11-design-system-editeur.md`) :

- [x] **Chips groupes** sur chaque ligne média — ex. `Montage couples` · `+2` si >2 groupes ; clic chip → ouvre `MediaGroupEditor` (`?group=`)
- [x] **Filtre par groupe** — chip dans le panneau `EditorFilterGroup` (API `groupId`) ; combinable avec recherche `q` et filtres kind existants
- [x] **Action « Nouveau groupe »** — bouton toolbar médiathèque (à côté upload) ; ouvre `MediaGroupEditor` vide
- [x] Édition groupe : modal fullscreen `MediaGroupEditor` · ordre membres ↑↓ · titres FR/EN · autosave ~500 ms · suppression disabled + tooltip si référencé dans ≥1 article
- [x] Compteur « N articles » visible dans l’éditeur groupe (scan bodies via `/references`)

### Évolutions design system requises

| Besoin | Composant / règle |
|--------|-------------------|
| Chips sur ligne média | `MediaGroupChips` — pastilles cliquables, max 2 visibles + badge « +N » |
| Filtre groupe | Extension `MediaLibraryManager` — param `groupId` dans toolbar filtres |
| Nouveau groupe | Bouton toolbar médiathèque → `MediaGroupEditor` (création) |
| Éditeur groupe | `MediaGroupEditor` modal fullscreen · URL virtuelle `?group=` |
| Chip bloc article | TipTap extension `MediaGroupBlock` · palette `#495867` |
| Mosaïque publique | `InlineMediaGroup` — layouts 1 / 2 / 3 / 4+ |
| Picker insertion | `MediaGroupPicker` — recherche + création rapide |
| Fiche média | Section « Groupes » (M:N) + lien édition |
| Galerie bas article | Bandeau alimenté par **manifeste unifié** (plus PostMedia seul) |

### URLs virtuelles

- Médiathèque : `?group=<id>` édite le groupe
- Article : `?group=<id>` depuis chip (même overlay)
- Parse + serialize dans `virtual-url.ts` + tests

## API

| Route | Action |
|-------|--------|
| `GET /api/media-groups` | Liste paginée (`q`, `limit`, `offset`) |
| `POST /api/media-groups` | Créer groupe (+ membres optionnels) |
| `GET /api/media-groups/:id` | Détail + membres ordonnés + `referencedByPostIds[]` |
| `PATCH /api/media-groups/:id` | Meta + remplacement membres ordonnés |
| `DELETE /api/media-groups/:id` | Supprimer si **0 référence** body, sinon 409 |
| `GET /api/media-groups/:id/references` | Posts dont body contient le placeholder |
| `GET /api/media-library` | Existant — ajouter filtre `groupId` (médias membres du groupe) |
| `GET /api/posts/:id/media-manifest` | Manifeste unifié (`locale` query) |
| `GET /api/slug-history/:entity/:slug` | Résolution redirect (interne middleware) |

Body autosave existant : placeholders conservés dans `bodyFr`/`bodyEn`.

## Agent Telegram / IA (`AI_TOOLS`)

Nouveaux tools (`category: media_groups`) :

| Tool | Rôle |
|------|------|
| `media_groups.list` | Lister / chercher groupes |
| `media_groups.get` | Détail + membres + articles référençants |
| `media_groups.create` | Créer avec `{ titleFr, titleEn?, layout?, mediaIds[] }` |
| `media_groups.update` | Meta + ordre membres |
| `media_groups.delete` | Refus si référencé (message explicite + liste posts) |
| `media_groups.add_media` / `remove_media` / `reorder` | Mutations ciblées |
| `posts.insert_media_group` | `{ postId, groupId, lang: fr\|en\|both, position?: end }` — injecte placeholder sans saisie manuelle |

Enrichissement prompt agent (`telegram/agent.ts` bootstrap) :

- Workflow : créer groupe en médiathèque → ajouter médias → `posts.insert_media_group` après le paragraphe pertinent
- Rappel : **ne jamais** coller `{{media-group:…}}` dans un patch `bodyFr` brut sans tool dédié
- Suppression groupe : toujours `media_groups.get` references d’abord
- Médias de groupe **n’ont pas** besoin d’être attachés via `media.attach` pour apparaître sur l’article public

Doc : `docs/09-telegram-publish.md` § tools groupes.

## Tests

- Parser placeholder round-trip (FR + EN positions différentes)
- **`buildArticleMediaManifest`** : couverture + 2 groupes + standalone, dedupe, ordre
- CRUD groupes + M:N membres + ordre
- DELETE 409 si référencé dans body
- Rendu public : mosaïque 1/2/3/4+, kinds mixtes, clic → bon `manifestIndex`
- Bandeau + diaporama = manifeste complet (pas PostMedia seul)
- TipTap serialize ↔ markdown token
- Slug history 301 (post + group + media)
- Sync TEST↔PROD : sérialiser `MediaGroup` + membres
- Tools Telegram : insert + create + delete guard
- API `GET …/media-manifest`

## Phasage implémentation

| Étape | Livrable |
|-------|----------|
| **1d-a** | Migration Prisma `MediaGroup` + `MediaGroupMember` + slug history tables + `Media.slug` | ✅ |
| **1d-b** | API CRUD + references scan + redirect blog 301 + **`/media-manifest`** + lib `article-media-manifest.ts` | ✅ |
| **1d-c** | parser body + `InlineMediaGroup` + évolution bandeau/`MediaSlideshow` (public/preview) | ✅ |
| **1d-d** | UI médiathèque intégrée — chips groupes, filtre, « Nouveau groupe », `MediaGroupEditor` | ✅ |
| **1d-e** | TipTap bloc + picker insertion article | ✅ |
| **1d-f** | URLs virtuelles + `AI_TOOLS` Telegram + tests + deploy | ✅ |

## Références

- Médiathèque : `docs/11-design-system-editeur.md`, `docs/12-photo-editor-medias.md`
- Modèle : `Media`, `PostMedia` (standalone attachments), `Post.bodyFr/En`, `MediaGroup`
- Widget : `web/src/components/MediaSlideshow.tsx`, `ArticleView.tsx`
- Telegram : `docs/09-telegram-publish.md`
- Phasage : `docs/06-spec-technique.md` § Phase 1d
