---
name: mini580-ingest
description: >-
  Reçoit les messages Telegram des comptes autorisés (liste d'IDs), stocke les
  médias, extrait métadonnées et déclenche le flux de validation bilingue.
---

# Class Mini 5.80 Ingest — Réception contenu Telegram

## Auth

Seuls les `TELEGRAM_ALLOWED_USER_IDS` peuvent démarrer `/nouveau`.

Le webhook Next.js (`POST /api/telegram/webhook`) porte la machine à états.
OpenClaw peut aussi appeler l'API avec `Authorization: Bearer $INGEST_API_KEY`.

## Déclencheurs

- DM Telegram (ou groupe allowlist) — commande `/nouveau`
- Photos + texte libre / structuré
- (Futur) Google Drive `À publier/`

## Pipeline

1. **Réception** — message Telegram
2. **Allowlist** — vérifier l'ID expéditeur
3. **Stockage médias** — download Telegram → `LocalDiskBucket` (`/media/{key}`)
4. **Collecte** — accumuler textes + photos jusqu'à « Terminer la saisie »
5. **Draft** — parsing IA (ou heuristique) → `Post` DRAFT + `PostImage[]`
6. → skill `mini580-publish-review` (validation FR → EN → preview → photos)

## Format structuré suggéré

```
Titre: Pose des couples #268
Date: 2026-07-16
Thèmes: chantier
Tags: époxy, couples
Jalon: pose-couples
---
Aujourd'hui sur la coque 268…
```

## Notification

```
Reçu — N photo(s), M message(s) texte.
→ Appuyer sur Terminer la saisie
```
