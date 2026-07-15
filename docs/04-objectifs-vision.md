# Objectifs & vision — Plateforme Mini 5.80 Baie de Somme

> Vision validée — juillet 2026

## Vision

Créer une **plateforme de documentation et publication** en deux couches :

1. **Couche pro (Admin)** — OpenClaw + Telegram pour concevoir, administrer et déployer le site
2. **Couche équipe (zero-tech)** — canaux simples (Telegram, Google Drive) pour que Laurent, Marco et Rodolphe publient sans compétence technique

### Objectifs métier

1. **Remplacer** le blog Blogger basique par un site professionnel
2. **Documenter** la construction des 3 coques #268, #269, #270 (exigences classe incluses)
3. **Permettre** à l'équipe de publier photos, articles, plans et réponses en quelques secondes
4. **Partager** astuces et retours d'expérience avec la communauté Class Globe 5.80
5. **Préparer** la communication autour des courses et de la flotte Baie de Somme

---

## Modèle d'usage

### Admin (votre compte)

| Besoin | Solution |
|--------|----------|
| Piloter le site à distance | Telegram DM → OpenClaw |
| Configurer la plateforme | OpenClaw Control UI |
| Valider les publications équipe | Notification Telegram → "Publie" |
| Développer le site / skills | OpenClaw agent + Cursor |
| Modérer commentaires & FAQ | Commandes admin via Telegram |

### Équipe (Laurent, Marco, Rodolphe)

| Besoin | Solution | Effort |
|--------|----------|--------|
| Publier des photos de chantier | Groupe Telegram + légende | ~30 sec |
| Partager un plan ou PDF | Déposer dans Google Drive | ~10 sec |
| Raconter une étape | Message vocal ou texte Telegram | Naturel |
| Répondre à une question | Répondre dans le fil Telegram | Naturel |

**Aucun CMS, aucun login web, aucune compétence technique.**

---

## Architecture

Voir le document détaillé : **[Architecture OpenClaw](05-architecture-openclaw.md)**

```
Équipe → Telegram / Google Drive → OpenClaw → Git → Site public
Admin  → Telegram DM / Control UI → OpenClaw → tout le reste
```

---

## Décisions prises

| Sujet | Décision |
|-------|----------|
| Control plane | **OpenClaw** (self-hosted) |
| Canal admin | **Telegram DM** + Control UI |
| Canal équipe | **Groupe Telegram** + **Google Drive** |
| Site public | Site statique (Astro/Next.js) alimenté par Git |
| Contenu | Markdown bilingue FR/EN, généré/assisté par OpenClaw |
| Blog existant | Migration des 3 articles Blogger |
| Identité | CNBS (*Chantier Naval de la Baie de Somme*) + "Les vieux fourneaux" |

## Décisions encore ouvertes

- [ ] **Domaine** : cnbs.fr, mini580-somme.fr, autre ?
- [ ] **Hébergement site** : Vercel, Netlify, GitHub Pages ?
- [ ] **Mode publication** : review systématique ou auto pour photos routinières ?
- [ ] **Hébergement OpenClaw** : Mac local, VPS (Hetzner…), autre ?
- [ ] **Sections site** : un site commun 3 coques ou 3 sous-sections distinctes ?
- [ ] **Ambition course** : Transat 2028, Mini Globe Race 2029 ?

---

## Prochaine étape

1. Valider l'architecture OpenClaw (doc `05-architecture-openclaw.md`)
2. Choisir domaine + hébergement
3. Installer OpenClaw et créer le bot Telegram
4. Lancer le squelette du site web dans ce repo
5. Développer le premier skill `cnbs-ingest` pour tester le flux équipe → site
