---
name: mini580-publish-review
description: >-
  Flux Telegram de validation assistée IA : confirmation FR, traduction EN,
  aperçu, ordre et métadonnées photos (centrage, crop, zoom, rotation), puis publication.
---

# Class Mini 5.80 — Review publication Telegram

Implémenté dans `web/src/lib/telegram/publish-flow.ts` (webhook bot).

## Étapes

| Step | Contenu | Actions |
|------|---------|---------|
| `REVIEW_FR` | Titre, date, texte, thèmes, tags (existants/nouveaux), jalon | Valider / Modifier |
| `REVIEW_EN` | Traduction IA titre + texte + tags nouveaux | Valider / Modifier |
| `REVIEW_PREVIEW` | Lien `/apercu/t/{token}` (72 h) | Valider / Modifier |
| `REVIEW_PHOTO_ORDER` | Liste ordonnée | Valider ou `ordre: 3,1,2` |
| `REVIEW_PHOTO_META_FR` | Par photo : titre, description, date, centrage, crop, zoom, rotation | Valider / Modifier |
| `REVIEW_PHOTO_META_EN` | Traduction IA titre + description | Valider / Modifier |
| `READY` | Publier ou garder brouillon | 🚀 Publier |

## Messages de confirmation (FR)

```
📋 Confirmation demande (FR)
Titre : …
Date de publication : …
Texte : …
Thèmes : …
Tags : … [nouveau]
Jalon timeline : …
Photos : N
```

## Messages de confirmation (EN)

Même structure avec title / body / themes / tags / milestone.

## Édition photo (exemples)

```
titre: Assemblage couple n°4
description: Vue latérale bâbord
date: 2026-07-16
centrage: 0.5,0.35
zoom: 1.15
rotation: 90
crop: 0.05,0.1,0.9,0.8
```

## APIs sous-jacentes

- `POST /api/media` — upload (Bearer `INGEST_API_KEY` ou session)
- `POST /api/posts` · `PATCH /api/posts/:id`
- `PUT /api/posts/:id/images` · `PATCH .../images/:imageId`
- `POST /api/translate` — `{ kind: "article" | "images", ... }`
- Preview token → `/apercu/t/:token` (sans login)
