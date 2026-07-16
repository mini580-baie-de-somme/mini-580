---
name: mini580-ingest
description: >-
  Reçoit les messages Telegram et fichiers Google Drive de l'équipe Class Mini 5.80 Baie de Somme,
  extrait métadonnées (coque, auteur, étape) et déclenche la rédaction bilingue.
---

# Class Mini 5.80 Ingest — Réception contenu équipe

## Déclencheurs

- Message reçu dans le groupe Telegram `#Mini580-Chantier`
- Nouveau fichier détecté dans Google Drive `Class Mini 5.80 Baie de Somme/À publier/`

## Entrées attendues

| Source | Format | Métadonnées à extraire |
|--------|--------|------------------------|
| Telegram | Photo(s) + texte libre | coque (#268/269/270), étape, auteur |
| Drive | PDF, images, plans | nom fichier, dossier, date |

## Pipeline

1. **Réception** — message Telegram ou webhook Drive
2. **Extraction** — parser texte pour coque, étape, auteur
3. **Validation** — vérifier allowlist expéditeur
4. **Stockage** — sauver médias localement (`uploads/`)
5. Sinon → déclencher le skill `mini580-draft`

## Notification équipe

```
🔔 Nouveau contenu Class Mini 5.80 Baie de Somme
Coque : #268
Étape : couples
Auteur : Laurent
→ Brouillon en cours de génération
```
