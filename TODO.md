# TODO — Class Mini 5.80 Baie de Somme

> Dernière mise à jour : 2026-08-14 · prod **v1.2.89** · v1.2.90 en cours (compaction non bloquante)

## ✅ Terminé — Phase 1c éditeur photo (août 2026)

- [x] Upload mobile fiable — XHR multipart + retry (v1.2.58)
- [x] Refresh vignette article après crop/rebake async (v1.2.60)
- [x] Canvas éditeur sur origin full-res, upload max 4096 px (v1.2.61)
- [x] Poll rebake baseline PATCH + replace sans rebake intermédiaire (v1.2.66)
- [x] Documentation specs `docs/12-photo-editor-medias.md` + tests référencés
- [x] Validation Hammed — « ça fonctionne bien maintenant » (2026-08-13)

## ✅ Terminé — Phase 1d groupes de médias inline (août 2026)

Spec : `docs/13-article-image-groups.md` · livré **v1.2.67 → v1.2.88** (TEST validé, PROD **v1.2.88**)

### Spec / doc

- [x] Modèle validé — groupe unique FR/EN, médiathèque, M:N, ordre, SEO slugs
- [x] Balise assistée `{{media-group:<id>}}` + enrichissement affichage `|Nom|N` (stockage id-only)
- [x] Tools Telegram `media_groups.*` + `posts.insert_media_group`
- [x] Manifeste unifié bandeau/diaporama (couverture → groupes inline → standalone)
- [x] Mosaïque inline carrée + lightbox groupe vs lightbox article complet
- [x] Navigation médiathèque — chips + filtre URL + « Nouveau groupe » (pas d’onglet dédié)

### Build

- [x] **1d-a** Prisma `MediaGroup` + `MediaGroupMember` + slug history + `Media.slug`
- [x] **1d-b** API CRUD + media-manifest + 301 slugs
- [x] **1d-c** parser body + `InlineMediaGroup` + bandeau/diaporama unifiés
- [x] **1d-d** UI médiathèque — chips, filtre, `MediaGroupEditor`, cartes mobile
- [x] **1d-e** TipTap `MediaGroupBlock` + picker insertion + persistance mode Visuel
- [x] **1d-f** Tools Telegram + tests (298+)

### Correctifs post-build (TEST → PROD)

- [x] Médiathèque mobile-first — header centré, cartes compactes (v1.2.76–78)
- [x] Autosave groupe — fix flicker boucle (v1.2.71)
- [x] Save média médiathèque — `saveMediaFlow` unifié post/library (v1.2.72)
- [x] Filtre groupe URL-sync + désélection toggle (v1.2.74–75)
- [x] Balises enrichies textarea + fix curseur mode Visuel (v1.2.81–82)
- [x] Mosaïque carrée inline + slider natif ratio (v1.2.82)
- [x] Swipe tactile + animation slide + scroll body bloqué (v1.2.83–86)
- [x] Slug groupe auto depuis titre (v1.2.87)
- [x] Footer Simohra FR/EN (v1.2.88)
- [x] Pipeline commit → push → CI → deploy TEST → validation Hammed → **deploy PROD v1.2.88**

### Correctif bot Telegram prod (2026-08-14)

- [x] Verrou thread + timeout 120s run.wait + after() webhook — **v1.2.89**
- [x] Tests CI 11/11 Telegram ✓ · deploy manuel (CI SSH timeout GitHub→VPS)

### Compaction non bloquante + non-régression (2026-08-14)

Spec : `docs/14-telegram-agent-compaction.md` · cible **v1.2.90**

- [x] Compaction hors lock tour — fire-and-forget post-réponse
- [x] Fork bootstrap si message pendant compaction (`compactingAgentIds`)
- [x] Reset optimiste `cursorAgentId` — fil forké préservé
- [x] Échec compaction → pas de reset historique
- [x] Tests `telegram-agent-compaction.test.ts` (local, mock Cursor SDK)
- [x] Tests `compaction-regression.test.ts` (webhook wiring)
- [ ] Commit → push → CI → deploy TEST → validation Hammed → deploy PROD **v1.2.90**
- [ ] Port aligné **simohra.fr** (clone mini580, branding Simohra)

## 📋 Backlog site (Phase 1)

- [ ] Migrer médias Blogger non conformes (re-upload originale locale)
- [ ] Jalons / tags / thèmes — étendre URLs virtuelles modales (MEMORY § mini-580)

## 📋 Phase 2 — Telegram équipe

- [ ] Installer OpenClaw VM dédiée + bot Telegram Class Mini 5.80 Baie de Somme
- [ ] Brancher `TELEGRAM_*` + `CURSOR_API_KEY` sur TEST — post bout-en-bout
- [ ] Valider flux review FR/EN (`docs/09-telegram-publish.md`)

## 📋 Phase 3 — plus tard

- [ ] Google Drive ingest
- [ ] Newsletter
- [ ] Commentaires

## Notes opérateur

- **Médias legacy** (~1600 px origin) : « Remplacer le fichier » pour regagner full res
- **Cache front** : hard refresh / navigation privée après deploy éditeur
- **Logs debug save** : console `[photo-editor-trace]` · serveur `[media-trace]`
- **Promotion PROD** : toujours la version exacte validée sur TEST (`/api/version`)
