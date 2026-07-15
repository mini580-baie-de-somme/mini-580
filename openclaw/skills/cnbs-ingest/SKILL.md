---
name: cnbs-ingest
description: >-
  Reçoit les messages Telegram et fichiers Google Drive de l'équipe CNBS,
  extrait les métadonnées (coque 268/269/270, auteur, étape chantier)
  et prépare un brouillon pour publication.
---

# CNBS Ingest — Réception contenu équipe

## Quand utiliser ce skill

- Message reçu dans le groupe Telegram `#CNBS-Chantier`
- Nouveau fichier détecté dans Google Drive `CNBS/À publier/`
- Admin demande de traiter un contenu brut

## Extraction des métadonnées

Analyser le message et extraire :

| Champ | Détection |
|-------|-----------|
| `coque` | 268, 269, 270 (ou null si non précisé) |
| `auteur` | Laurent, Marco, Rodolphe (via Telegram user ID) |
| `etape` | couples, plaquage, fournisseurs, cnc, epoxy, quille… |
| `type` | photo, article, plan, vocal, question |
| `date` | timestamp du message |

## Actions

1. Télécharger les médias (photos, vocaux, documents)
2. Sauvegarder dans `content/inbox/{date}-{slug}/`
3. Créer un fichier `meta.json` avec les métadonnées extraites
4. Si type = question → notifier l'admin, ne pas publier
5. Sinon → déclencher le skill `cnbs-draft`

## Format de notification admin

```
🔔 Nouveau contenu CNBS
Auteur : Marco
Coque  : 269
Étape  : fournisseurs
Médias : 3 photos
→ Brouillon prêt. Répondez "Publie" pour mettre en ligne.
```

## Règles

- Ne jamais publier sans validation admin (sauf mode auto activé)
- Conserver les originaux dans `content/inbox/`
- Vocal → transcrire avant draft
