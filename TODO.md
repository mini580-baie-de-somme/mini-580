# TODO — Class Mini 5.80 Baie de Somme

> Dernière mise à jour : 2026-08-13 · prod **v1.2.66**

## ✅ Terminé récemment — éditeur photo (août 2026)

- [x] Upload mobile fiable — XHR multipart + retry (v1.2.58)
- [x] Refresh vignette article après crop/rebake async (v1.2.60)
- [x] Canvas éditeur sur origin full-res, upload max 4096 px (v1.2.61)
- [x] Poll rebake baseline PATCH + replace sans rebake intermédiaire (v1.2.66)
- [x] Documentation specs `docs/12-photo-editor-medias.md` + tests référencés
- [x] Validation Hammed — « ça fonctionne bien maintenant » (2026-08-13)

## 🔜 Phase 1d — groupes de médias inline

Spec validée : `docs/13-article-image-groups.md`

### Spec / doc (avant code)

- [x] Valider modèle avec Hammed — groupe unique FR/EN, médiathèque, M:N, ordre, SEO slugs
- [x] Spec balise assistée `{{media-group:<id>}}` + TipTap bloc
- [x] Spec tools Telegram `media_groups.*` + `posts.insert_media_group`
- [x] Tranché : médias inline **libres** — pas dans `PostMedia` requis ; pas d’auto-attach
- [x] Tranché : bandeau + diaporama **évolués** — manifeste unifié (couverture → groupes inline → standalone)
- [x] Tranché : mosaïque inline + réutilisation `MediaSlideshow` (lightbox manifeste global)
- [x] Tranché : **pas d’onglet/route groupes** — chips sur médias + filtre par groupe + « Nouveau groupe » dans médiathèque

### Build (spec prête — go)

- [x] **1d-a** Migration Prisma `MediaGroup` + `MediaGroupMember` + slug history + `Media.slug`
- [x] **1d-b** API CRUD `/api/media-groups` + scan références body + 301 slugs + `GET …/media-manifest`
- [x] **1d-c** parser body + `InlineMediaGroup` + bandeau/diaporama unifiés (public + preview)
- [x] **1d-d** UI médiathèque intégrée — chips groupes, filtre, « Nouveau groupe », `MediaGroupEditor`
- [x] **1d-e** TipTap `MediaGroupBlock` + picker « Insérer un groupe »
- [x] **1d-f** URLs virtuelles `?group=` + tools Telegram `media_groups.*` + `posts.insert_media_group` + tests
- [ ] Pipeline complet : commit → push → CI → deploy TEST → validation → PROD

## 📋 Backlog site (Phase 1)

- [ ] Migrer médias Blogger non conformes (re-upload originale locale)
- [ ] Jalons / tags / thèmes — étendre URLs virtuelles modales (MEMORY § mini-580)

## 📋 Phase 2 — Telegram équipe

- [ ] Installer OpenClaw VM dédiée + bot Telegram Class Mini 5.80 Baie de Somme
- [ ] Brancher `TELEGRAM_*` + `CURSOR_API_KEY` sur TEST — post bout-en-bout
- [ ] Valider flux review FR/EN (`docs/09-telegram-publish.md`)
- [x] Phase 1d-f : tools `media_groups.*` côté agent

## 📋 Phase 3 — plus tard

- [ ] Google Drive ingest
- [ ] Newsletter
- [ ] Commentaires

## Notes opérateur

- **Médias legacy** (~1600 px origin) : « Remplacer le fichier » pour regagner full res
- **Cache front** : hard refresh / navigation privée après deploy éditeur
- **Logs debug save** : console `[photo-editor-trace]` · serveur `[media-trace]`
