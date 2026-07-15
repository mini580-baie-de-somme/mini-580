# Mini 5.80 — Baie de Somme

Plateforme de documentation, publication et communication autour de la construction de **trois Class Globe 5.80** sur la Baie de Somme.

**Stack :** site statique + **OpenClaw** (control plane) + **Telegram** / **Google Drive** (canaux équipe zero-tech).

## Le projet

Trois amis — **Laurent**, **Marco** et **Rodolphe** — construisent chacun leur voilier Class Globe 5.80 (coques **#268**, **#269** et **#270**) dans le **CNBS** (*Chantier Naval de la Baie de Somme*), une grange de 250 m² près de la baie.

Ce dépôt part de zéro pour reconstruire le site web, la documentation et la communication à partir du blog existant [cg268269270.blogspot.com](https://cg268269270.blogspot.com/).

## Deux couches

| Rôle | Interface | Objectif |
|------|-----------|----------|
| **Admin / Webmaster** (vous) | OpenClaw + Telegram DM + Control UI | Concevoir, administrer, valider, déployer |
| **Équipe chantier** | Groupe Telegram + Google Drive | Publier photos, articles, plans — zéro technique |

## Documentation

| Document | Contenu |
|----------|---------|
| [Contexte Class Globe 5.80](docs/01-contexte-class-globe-580.md) | Classe, règles, communauté mondiale, courses |
| [Projet CNBS](docs/02-projet-cnbs.md) | Équipe, chantier, rôles, état d'avancement |
| [Blog existant](docs/03-blog-existant.md) | Inventaire du contenu à migrer |
| [Objectifs & vision](docs/04-objectifs-vision.md) | Vision validée, décisions, prochaines étapes |
| [Architecture OpenClaw](docs/05-architecture-openclaw.md) | Schéma technique, pipeline publication, skills |

## Liens utiles

- [Class Globe 5.80 — site officiel](https://classglobe580.com/)
- [Builders Blogs officiels](https://classglobe580.com/builders-blogs/)
- [Globe 5.80 Transat](https://globe580transat.com/)
- [Mini Globe Race](https://minigloberace.com/)
- [Kit France — kit-bateau.fr](https://www.kit-bateau.fr/produit/kit-class-globe-5-80/)
- [Blog actuel CNBS](https://cg268269270.blogspot.com/)

## Prochaines étapes

1. Valider l'architecture OpenClaw (`docs/05-architecture-openclaw.md`)
2. Installer OpenClaw + créer le bot et le groupe Telegram CNBS
3. Lancer le squelette du site web (Astro/Next.js)
4. Développer le skill `cnbs-ingest` (Telegram → brouillon article)
5. Migrer les 3 articles Blogger et tester le premier flux équipe → site
