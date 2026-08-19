# Liens externes inline — articles

> Spec **validée et livrée** — août 2026 · **Phase 1e** ✅ **v1.2.118** (TEST déployé · PROD en attente validation)

## Problème

Les articles ne permettaient que du texte riche et des blocs médias. Les liens vers des ressources externes (fournisseurs, plans, sites officiels) étaient soit tapés à la main dans le corps (fragile, pas réutilisable), soit absents du catalogue éditeur.

## Objectif

Créer des **liens externes réutilisables** (catalogue éditeur), les **insérer** à des endroits précis du corps FR/EN d’un ou plusieurs articles, avec rendu public bilingue cohérent et garde-fous de suppression.

## Décisions validées

| Sujet | Décision |
|-------|----------|
| FR / EN | **Libellés bilingues** (`labelFr`, `labelEn`) ; URL **unique** (`url`) **ou** paire `urlFr` + `urlEn` |
| Création | **Catalogue éditeur** `/editeur/liens` — entité indépendante des articles |
| Lien ↔ article | **0..N articles** — référence via placeholder dans `bodyFr` / `bodyEn` |
| Suppression | **Interdite (409)** si le lien est référencé dans au moins un corps d’article |
| Placeholder body | **Jamais tapé à la main** — insertion 100 % assistée (UI + agent Telegram) |
| Token stocké | **`{{external-link:<id>}}`** uniquement (id = `ExternalLink.id` cuid) |
| Affichage éditeur | Sur-charge lisible `{{external-link:<id>\|<label>\|<url>}}` — **nettoyée à la sauvegarde** (même pattern que groupes médias) |
| Brouillon rapide | Popin « Insérer un lien » → **« Nouveau lien »** crée un brouillon vide + insertion immédiate |

## Modèle de données

### Entité `ExternalLink`

| Champ | Type | Rôle |
|-------|------|------|
| `id` | cuid | PK stable (référence dans les bodies) |
| `labelFr` / `labelEn` | string | Libellé affiché (peut être vide à la création brouillon) |
| `url` | string? | URL unique pour les deux locales |
| `urlFr` / `urlEn` | string? | URLs séparées si pas de `url` |
| `createdAt` | DateTime | Audit |

**Contrainte URL :** soit `url` (http/https valide), soit **les deux** `urlFr` et `urlEn`. Normalisation serveur : `normalizeExternalLinkUrls()` dans `web/src/lib/external-links.ts`.

**Pas de FK `postId`** — liaison article ↔ lien via scan du placeholder dans le body.

## Référence dans le body (`bodyFr` / `bodyEn`)

**Format canonique de stockage :**

```markdown
{{external-link:clxyz123abc}}
```

**Sur-charge éditeur (textarea / enrichissement live) :**

```markdown
{{external-link:clxyz123abc|Kit bateau|https://example.com}}
```

- `cleanExternalLinkTokens()` → id-only avant persistance
- `enrichExternalLinkTokens()` → injecte label + URL à l’affichage éditeur
- Parser segments : `web/src/lib/article-body-segments.ts` (`type: "external-link"`)

## Insertion (article)

### Éditeur web

- Toolbar corps : **« Insérer un lien »** → `ExternalLinkPicker` (recherche + liste paginée)
- **« Nouveau lien »** dans la popin : `POST /api/external-links` (labels vides, URL optionnelle) → insertion TipTap au curseur
- **TipTap** : nœud atomique `externalLinkBlock` — chip `🔗 libellé ↗` (live depuis API)
- Clic chip → ouvre `/editeur/liens/[id]/modifier` (nouvel onglet)
- Suppression chip → retire le placeholder du body (le lien reste en catalogue)

### Module admin `/editeur/liens`

Pattern entité identique aux **jalons** (design system § listes) :

| Route | Rôle |
|-------|------|
| `/editeur/liens` | Liste + recherche + infinite scroll |
| `/editeur/liens/nouveau` | Création |
| `/editeur/liens/[id]` | Consultation + articles référents + suppression |
| `/editeur/liens/[id]/modifier` | Édition (autosave) |

Composants : `ExternalLinkManager`, `ExternalLinkConsultation`, `ExternalLinkEditorForm`.

## Affichage public

- `ArticleBody` parse les segments ; `InlineExternalLink` rend un bouton lien (`target="_blank"`, `rel="noopener noreferrer"`)
- Label = `labelFr` ou `labelEn` selon locale ; href = `resolveExternalLinkUrl(link, locale)`
- Lien introuvable ou URL manquante → bandeau ambre (comme groupe média orphan)

## API

| Route | Méthode | Rôle |
|-------|---------|------|
| `/api/external-links` | GET | Liste (paginée si `paginated=1`) ou tableau complet (sélecteurs) |
| `/api/external-links` | POST | Créer (brouillon ou complet) |
| `/api/external-links/:id` | GET/PATCH/DELETE | Détail · MAJ · suppression (409 si référencé) |
| `/api/external-links/:id/references` | GET | Articles contenant le placeholder |
| `/api/posts/:id/insert-external-link` | POST | Insertion assistée `{ linkId, lang?, position? }` |

Auth : cookie session **ou** Bearer `INGEST_API_KEY`.

## Sync catalogue TEST ↔ PROD

Les liens externes font partie du **catalogue** synchronisé avec tags, thèmes et jalons :

- Export : `sync.ts` → `externalLinks[]` dans le payload peer
- Import : upsert par `id` (`POST /api/sync/peer/import`)
- Schéma Zod peer inclut `externalLinks` (fix v1.2.111)

Voir **`docs/08-sync-test-prod.md`**.

## Agent Telegram (tools IA)

| Tool | Rôle |
|------|------|
| `external_links.list` | Catalogue paginé |
| `external_links.get` | Détail |
| `external_links.create` | Créer (labels + url ou urlFr/urlEn) |
| `external_links.update` | MAJ |
| `external_links.delete` | Supprimer (409 si référencé) |
| `external_links.references` | Scan articles avant delete |
| `posts.insert_external_link` | Injection placeholder — **ne jamais coller `{{external-link:…}}` à la main** |

Prompt agent : `web/src/lib/telegram/agent.ts` · catalogue : `web/src/lib/ai-tools.ts`.

## Phasage implémentation

| Étape | Livrable | Statut |
|-------|----------|--------|
| **1e-a** | Prisma `ExternalLink` + migration | ✅ |
| **1e-b** | API CRUD + references + insert-external-link + delete 409 | ✅ |
| **1e-c** | Parser body + `InlineExternalLink` + rendu public/preview | ✅ |
| **1e-d** | Module admin `/editeur/liens` (pattern jalons) | ✅ |
| **1e-e** | TipTap bloc + picker + « Nouveau lien » + tokens enrichis | ✅ |
| **1e-f** | Sync catalogue + tools Telegram + tests + deploy TEST | ✅ |

## Implémentation livrée (v1.2.110 → v1.2.118)

| Sujet | Comportement livré |
|-------|-------------------|
| Token body | Stockage id-only ; textarea enrichi label+URL (nettoyé au save) |
| TipTap Visuel | Chip live 🔗 + libellé ; persistance round-trip HTML `data-external-link-id` |
| Picker | Recherche debounced + création brouillon inline |
| CRUD admin | Liste → consultation → modifier ; pas de colonne Actions |
| Delete guard | 409 + liste articles référents sur fiche consultation |
| Sync | `externalLinks` dans export/import catalogue peer |
| Tests | `external-links`, `external-link-token`, `article-body-segments`, `sync`, `ai-tools` — **365** tests locaux |

## Déploiement

| Env | Version | Statut |
|-----|---------|--------|
| **TEST** | **v1.2.118** | ✅ Déployé (main) |
| **PROD** | **v1.2.118** | ✅ Promu 2026-08-19 |

Checklist opérateur :

1. Vérifier `GET https://test.classmini580.blog/api/version` → `1.2.118`
2. Tester CRUD `/editeur/liens`, insertion article, rendu public, sync catalogue
3. Valider agent Telegram : `external_links.create` + `posts.insert_external_link`
4. Deploy PROD manuel avec `expected_version: 1.2.118` — voir `docs/07-deploy-cicd.md`

## Références

- Design system listes : `docs/11-design-system-editeur.md` § Liens externes
- Modèle global : `docs/06-spec-technique.md` § Phase 1e
- Groupes médias (pattern token enrichi) : `docs/13-article-image-groups.md`
- Telegram : `docs/09-telegram-publish.md`
- Tests : `docs/10-api-integration-tests.md`
- Code : `web/src/lib/external-link-token.ts`, `external-links.ts`, `tiptap/external-link-block.tsx`
