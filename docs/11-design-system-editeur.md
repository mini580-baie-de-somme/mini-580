# Design system — listes éditeur (`/editeur`)

Règles UI obligatoires pour **toutes** les listes CRUD de l’espace éditeur : articles, tags, thématiques, jalons, médiathèque.

## Règles déjà en place (chrome / produit)

- Palette maritime : texte `#0D131A` / `#495867`, bordures `#d4dde6`, fond table `#f4f7fa`, hover ligne `#f8fafc`, CTA `#495867`
- Conteneur liste : `rounded-lg border border-[#d4dde6] bg-white`
- Table HTML réelle : un `<th>` / `<td>` par colonne (pas de `colSpan` + grille CSS pour simuler les colonnes)
- Colonnes secondaires masquées en responsive (`hidden sm:table-cell` / `md:table-cell`) de façon **identique** entre en-tête et cellules
- Formulaires de création / édition inline au-dessus de la liste (tags, thèmes, jalons, galerie) ou page dédiée (articles)
- Modules : Articles, **Galerie (médiathèque)**, Jalons, Thématiques, Tags, Sync
- i18n FR/EN via `web/src/lib/i18n.ts`

## Médiathèque (`/editeur/galerie`)

- Entité `Media` indépendante (`IMAGE` | `DOCUMENT` | `VIDEO`), liaison M:N via `PostMedia`
- CRUD liste design system + upload PDF/vidéo/photo
- Dans un article : upload **ou** sélection depuis la médiathèque (`media.attach`)
- Détacher ≠ supprimer : `DELETE …/posts/:id/media/:mediaId` vs `DELETE …/media-library/:id`

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

### 2. Compteur de lignes

- Sans filtre / recherche : `{n} ligne(s)` (`list.count`) avec le total global (`totalAll`)
- Avec recherche ou filtre : `{result} / {total} ligne(s)` (`list.countFiltered`)
  - `result` = nombre de lignes matchant le filtre (`total`)
  - `total` = total sans filtre (`totalAll`)
- Composant : `EditorListCount`

### 3. Clic sur la ligne → ouvrir en modification

- Clic n’importe où sur la ligne (sauf zone Actions) ouvre l’édition
- Articles : navigation vers `/editeur/[id]`
- Tags / thèmes / jalons : ouvre le formulaire d’édition inline (`startEdit`)
- `cursor-pointer` + hover de fond sur `<tr>`

### 4. Actions dans les lignes

- Colonne **Actions** toujours présente
- Au minimum : Éditer + Supprimer (et actions contextuelles : Publier PROD, etc.)
- Les boutons / liens de la colonne Actions font `stopPropagation` pour ne pas déclencher le clic ligne
- Styles : liens texte `text-xs`, supprimer en rouge

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
| Tags / thèmes / jalons | `TagManager` / `ThemeManager` / `MilestoneManager` |

## Checklist nouvelle liste éditeur

- [ ] Toolbar `[Rechercher] [barre] [Filtres ▼]` via `EditorListToolbar`
- [ ] Chips actifs sous la barre + × pour retirer
- [ ] Panneau Filtres collapsible (si filtres métier)
- [ ] Compteur total + `result / total` si filtré
- [ ] Clic ligne → édition
- [ ] Colonne Actions (éditer / supprimer + stopPropagation)
- [ ] Infinite scroll (`useEditorInfiniteList` + API `{ items, total, totalAll }`)
- [ ] Table avec `<td>` alignés sur les `<th>`
