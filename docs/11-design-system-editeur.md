# Design system — listes éditeur (`/editeur`)

Règles UI obligatoires pour **toutes** les listes CRUD de l’espace éditeur : articles, tags, thématiques, jalons.

## Règles déjà en place (chrome / produit)

- Palette maritime : texte `#0D131A` / `#495867`, bordures `#d4dde6`, fond table `#f4f7fa`, hover ligne `#f8fafc`, CTA `#495867`
- Conteneur liste : `rounded-lg border border-[#d4dde6] bg-white`
- Table HTML réelle : un `<th>` / `<td>` par colonne (pas de `colSpan` + grille CSS pour simuler les colonnes)
- Colonnes secondaires masquées en responsive (`hidden sm:table-cell` / `md:table-cell`) de façon **identique** entre en-tête et cellules
- Formulaires de création / édition inline au-dessus de la liste (tags, thèmes, jalons) ou page dédiée (articles)
- i18n FR/EN via `web/src/lib/i18n.ts`

## Règles listes (obligatoires)

### 1. Recherche en haut de liste

- Champ recherche + bouton filtrer **au-dessus** du compteur et de la table
- Articles : recherche + filtres (statut, coque, thème, tag) — `EditorPostFilters`
- Autres modules : au minimum recherche texte — `EditorListSearch`
- Filtrage côté API (`q`, plus filtres métier si besoin)

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
| Hook infinite scroll | `web/src/components/useEditorInfiniteList.ts` |
| Recherche | `web/src/components/EditorListSearch.tsx` |
| Compteur | `web/src/components/EditorListCount.tsx` |
| Helpers API | `web/src/lib/editor-list.ts` |
| Articles | `web/src/components/EditorPostList.tsx` |
| Tags / thèmes / jalons | `TagManager` / `ThemeManager` / `MilestoneManager` |

## Checklist nouvelle liste éditeur

- [ ] Recherche en tête
- [ ] Compteur total + `result / total` si filtré
- [ ] Clic ligne → édition
- [ ] Colonne Actions (éditer / supprimer + stopPropagation)
- [ ] Infinite scroll (`useEditorInfiniteList` + API `{ items, total, totalAll }`)
- [ ] Table avec `<td>` alignés sur les `<th>`
