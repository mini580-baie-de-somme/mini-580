# Design system — listes éditeur (`/editeur`)

Règles UI obligatoires pour **toutes** les listes CRUD de l’espace éditeur : articles, tags, thématiques, jalons, médiathèque.

## Règles déjà en place (chrome / produit)

- Palette maritime : texte `#0D131A` / `#495867`, bordures `#d4dde6`, fond table `#f4f7fa`, hover ligne `#f8fafc`, CTA `#495867`
- Conteneur liste : `rounded-lg border border-[#d4dde6] bg-white`
- Table HTML réelle : un `<th>` / `<td>` par colonne (pas de `colSpan` + grille CSS pour simuler les colonnes)
- Colonnes secondaires masquées en responsive (`hidden sm:table-cell` / `md:table-cell`) de façon **identique** entre en-tête et cellules
- Formulaires inline au-dessus de la liste (tags, thématiques, galerie) ou pages dédiées (articles, **jalons**)
- Modules : Articles, **Galerie (médiathèque + groupes intégrés Phase 1d)**, Jalons, Thématiques, Tags, Sync
- i18n FR/EN via `web/src/lib/i18n.ts`

## Médiathèque (`/editeur/galerie`)

- Entité `Media` indépendante (`IMAGE` | `DOCUMENT` | `VIDEO`), liaison M:N via `PostMedia`
- CRUD liste design system + upload PDF/vidéo/photo
- Dans un article : upload **ou** sélection depuis la médiathèque (`media.attach`)
- Détacher ≠ supprimer : `DELETE …/posts/:id/media/:mediaId` vs `DELETE …/media-library/:id`
- **Édition IMAGE** : modal fullscreen (`PhotoEditModal`) — URL virtuelle `?media=<id>` (back navigateur ferme)
- **Intégrité stockage** : colonne **Stockage** — badge `Local OK` / `Non conforme` ; liens URL externe cliquables sous le badge ; panneau ambre si origin non locale (Remplacer / Coller avant layout)
- Spec détaillée : **`docs/12-photo-editor-medias.md`**

## Éditeur article — médias attachés

- Bandeau pictos : **wrap** (`flex-wrap`) — pas de scroll horizontal page (~5+ pictos)
- Boutons réordonnancement ← → : touch target **36px**
- Modales photo/couverture : URLs virtuelles `?photo=`, `?cover=`, `?library=` — voir doc 12
- **Phase 1d** : le bandeau éditeur continue de gérer les **standalone** `PostMedia` ; les médias des groupes inline peuvent être absents du bandeau (affichés via chip dans le corps)

## Groupes de médias (Phase 1d — `docs/13-article-image-groups.md`)

- Entité **`MediaGroup`** indépendante (médiathèque) — M:N avec `Media`, référencée dans `bodyFr`/`bodyEn` via token assisté
- **Pas d’onglet / route dédiée** — groupes gérés **dans** `/editeur/galerie` :
  - **Chips** sur chaque ligne média (appartenance M:N, clic → édition groupe)
  - **Filtre par groupe** dans le panneau Filtres (`EditorFilterGroup`)
  - **Bouton « Nouveau groupe »** dans la toolbar médiathèque
- **Éditeur groupe** : modal fullscreen · URL virtuelle `?group=<id>` · drag ordre membres · titres FR/EN
- **Corps d’article (TipTap)** : bloc atomique non éditable (chip « 📷 Titre · N médias ») — l’utilisateur **ne tape jamais** le token `{{media-group:…}}`
- Toolbar corps : bouton **« Insérer un groupe »** → picker + création rapide
- Suppression groupe : disabled si référencé dans ≥1 article (tooltip + lien articles)
- Fiche média : section « Groupes » listant les appartenances M:N

### Public / preview — mosaïque inline + galerie unifiée

- **`InlineMediaGroup`** : mosaïque **carrée** (`aspect-square`, crop centré) selon count (1 · 2 · 3 · 4+ grille 2×2 + badge « +N »)
- Clic mosaïque → **`MediaSlideshow`** en mode **groupe** (médias du groupe uniquement, ordre `sortOrder`)
- Clic bandeau bas / diaporama → **`MediaSlideshow`** en mode **manifeste article** (couverture + inline + standalone, dedupe)
- Spec algorithmique : `docs/13-article-image-groups.md` § Manifeste médias unifié

### Médiathèque mobile (v1.2.76+)

- Header centré, retour « ← Posts » séparé, CTAs grille 2 colonnes (Nouveau groupe · Ajouter un média)
- Liste mobile : cartes horizontales compactes (`MediaLibraryMobileCard`) — thumb 72px, meta, badges, actions icônes discrètes
- Filtres synchronisés URL (`groupId`, `kind`, `visibility`, `q`) — re-clic chip groupe actif = désélection

## Règles listes (obligatoires)

### 1. Recherche et filtrage (toolbar standard)

Composant : **`EditorListToolbar`** (ou `EditorListSearch` / `EditorPostFilters` qui l’utilisent).

Disposition **obligatoire** (une seule ligne, wrap si besoin) :

```
[ Rechercher ]  [======== barre de recherche ========]  [ Filtres ▼ ]
```

- **Rechercher** (`list.search`) : à **gauche** de la barre — soumet la recherche texte
- **Barre** : champ `type="search"`, placeholder métier (`editor.search`, `media.search`, …)
- **Filtres** (`editor.filters.toggle`) : à **droite** — ouvre/ferme le panneau des chips de filtrage ; badge compteur si filtres actifs ; chevron ▼/▲
- Sans filtres métier (tags / thèmes / jalons) : pas de bouton Filtres

**Chips actifs** (sous la ligne recherche, toujours visibles s’il y en a) :

- Une pastille par filtre actif : `Préfixe: valeur ×`
- Clic sur la pastille (ou ×) retire ce filtre
- Si ≥ 2 chips : lien « Tout effacer » (`editor.filters.clearAll`)
- Inclure la recherche `q` comme chip (`Recherche: …`)

**Panneau Filtres** (sous la toolbar, bordure haute) :

- Groupes de chips via `EditorFilterGroup` + `EditorFilterChip`
- Style actif : fond `#495867` texte blanc ; inactif : bordure `#d4dde6`
- Filtrage côté API (`q` + clés métier)

Référence articles : `EditorPostFilters` · médiathèque : `MediaLibraryManager`  
Surfaces publiques : **Blog** (`BlogFilters`) · **Galerie** (`GalleryPageContent`) — même toolbar


### 2. Compteur de lignes

- Sans filtre / recherche : `{n} ligne(s)` (`list.count`) avec le total global (`totalAll`)
- Avec recherche ou filtre : `{result} / {total} ligne(s)` (`list.countFiltered`)
  - `result` = nombre de lignes matchant le filtre (`total`)
  - `total` = total sans filtre (`totalAll`)
- Composant : `EditorListCount`

### 3. Clic sur la ligne → ouvrir en modification

- Clic n’importe où sur la ligne (sauf zone Actions) ouvre l’édition
- Articles : navigation vers `/editeur/[id]`
- Tags / thématiques : ouvre le formulaire d’édition inline (`startEdit`)
- **Jalons** : navigation vers `/editeur/jalons/[id]` (consultation) ; création via `/editeur/jalons/nouveau` ; modification via `/editeur/jalons/[id]/modifier`
- **Liens externes** : même pattern entité — `/editeur/liens/[id]`, `/editeur/liens/nouveau`, `/editeur/liens/[id]/modifier`
- `cursor-pointer` + hover de fond sur `<tr>`

### 4. Actions dans les lignes

- Colonne **Actions** : tags / thématiques — Éditer + Supprimer (+ `stopPropagation`)
- **Jalons** : pas de colonne Actions — clic ligne uniquement ; actions (Modifier, Supprimer, Publier PROD) sur la page consultation
- **Liens externes** : pas de colonne Actions — consultation avec articles référents ; suppression bloquée si référencé
- Liste jalons : date de début + date de fin (si définie) sous la date de début

### 5. Infinite scroll

- Pagination serveur : `limit` / `offset` (page size = `EDITOR_LIST_PAGE_SIZE`, 20)
- Chargement suivant via `IntersectionObserver` sur un sentinelle sous la table
- Hook partagé : `useEditorInfiniteList`
- Réponse API paginée : `{ items, total, totalAll, limit, offset }`
- Compat : `GET /api/tags|themes|milestones` **sans** `limit`/`offset`/`q` continue de renvoyer un tableau (sélecteurs, outils IA)

### 6. Alignement colonnes

- Interdit : une seule cellule `colSpan` avec grille interne
- Obligatoire : autant de `<td>` que de `<th>`, mêmes classes de visibilité responsive

## Implémentation de référence

| Élément | Fichier |
|---------|---------|
| Toolbar recherche / filtres | `web/src/components/EditorListToolbar.tsx` |
| Recherche simple | `web/src/components/EditorListSearch.tsx` |
| Filtres articles | `web/src/components/EditorPostFilters.tsx` |
| Hook infinite scroll | `web/src/components/useEditorInfiniteList.ts` |
| Compteur | `web/src/components/EditorListCount.tsx` |
| Helpers API | `web/src/lib/editor-list.ts` |
| Articles | `web/src/components/EditorPostList.tsx` |
| Médiathèque | `web/src/components/MediaLibraryManager.tsx` |
| Tags / thèmes / jalons / liens | `TagManager` / `ThemeManager` / `MilestoneManager` / `ExternalLinkManager` |

## Checklist nouvelle liste éditeur

- [ ] Toolbar `[Rechercher] [barre] [Filtres ▼]` via `EditorListToolbar`
- [ ] Chips actifs sous la barre + × pour retirer
- [ ] Panneau Filtres collapsible (si filtres métier)
- [ ] Compteur total + `result / total` si filtré
- [ ] Clic ligne → édition
- [ ] Colonne Actions (éditer / supprimer + stopPropagation)
- [ ] Infinite scroll (`useEditorInfiniteList` + API `{ items, total, totalAll }`)
- [ ] Table avec `<td>` alignés sur les `<th>`
