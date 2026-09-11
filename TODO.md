# TODO — Class Mini 5.80 Baie de Somme

> Dernière mise à jour : 2026-09-11 · prod **v1.2.137** · test **v1.2.137** (`main` @ `a36daff`)

## ✅ Terminé — Phase 1e liens externes inline (août 2026)

Spec : `docs/16-external-links.md` · livré **v1.2.110 → v1.2.118** · inclus dans live **v1.2.137** TEST+PROD

- [x] Modèle `ExternalLink` — labels FR/EN + url unique ou urlFr/urlEn
- [x] API CRUD + references + insert-external-link + delete 409 si référencé
- [x] Token `{{external-link:id}}` + sur-charge éditeur label|url (id-only au save)
- [x] TipTap bloc + picker « Insérer un lien » + « Nouveau lien » (brouillon + insert)
- [x] Admin `/editeur/liens` — pattern jalons (liste → consult → edit)
- [x] Rendu public `InlineExternalLink` + preview
- [x] Sync catalogue TEST↔PROD inclut `externalLinks`
- [x] Tools Telegram `external_links_*` + `posts.insert_external_link`
- [x] Tests — external-links, token, segments, sync, ai-tools (**365** local)
- [x] Ship TEST ✓ **v1.2.118** → supersédé par live **v1.2.137**
- [x] Deploy PROD ✓ **v1.2.118** (2026-08-19) → live **v1.2.137** (liens externes en prod)

## ✅ Terminé — Phase 1f timeline & métriques (inclus live v1.2.137)

Spec : `docs/15-timeline-metrics.md` · `docs/12-photo-editor-medias.md` (crop formats) · ship TEST **v1.2.93+** · inclus live TEST+PROD **v1.2.137**

- [x] Login anti-enumération — messages génériques (password + OTP)
- [x] Crop 5 formats — SQUARE (défaut upload), 16:9, 4:3, 3:4, CIRCLE + rebake dynamique
- [x] Post `workDays` — DB + API + éditeur + agent
- [x] Milestone `endDate` + `workloadForecast` — DB + API + éditeur jalons
- [x] Timeline — barres jalons, traits discontinus entre périodes, étapes articles, métriques header
- [x] Médiathèque — chips groupes plus lisibles (stack, break-words)
- [x] Agent Telegram — brief + tools MAJ
- [x] Tests — `timeline-metrics`, `crop-formats`, `auth-security` + milestones/posts workDays
- [x] Ship TEST ✓ v1.2.93 → live TEST+PROD **v1.2.137**

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

## ✅ Terminé — Phase 2 Telegram équipe (live TEST+PROD v1.2.137)

Spec : `docs/09-telegram-publish.md` · bot **dans l’app Next.js** (webhook `POST /api/telegram/webhook`) — **pas** une VM OpenClaw séparée

> **VM OpenClaw dédiée = abandonné / hors chemin.** Le bot publication vit dans le runtime Next (TEST+PROD). OpenClaw workspace reste le control plane ops SimohraAgent, pas l’hébergeur du bot CNBS.

- [x] Bot Telegram intégré Next.js (webhook `/api/telegram/webhook`) — allowlist + agent Cursor tools
- [x] Secrets `TELEGRAM_*` + webhook live TEST+PROD (401 sans secret = route active)
- [x] Flux review FR/EN fonctionnel (`docs/09-telegram-publish.md`)
- [x] Correctif bot prod — verrou thread + timeout 120s + after() — **v1.2.89**
- [x] Compaction non bloquante + non-régression — **v1.2.90+** (`docs/14-telegram-agent-compaction.md`)
- [x] Live TEST+PROD **v1.2.137** (`main` @ `a36daff`)

## 📋 Backlog

- [ ] Migrer médias Blogger non conformes (re-upload originale locale)
- [ ] Jalons / tags / thèmes — étendre URLs virtuelles modales (MEMORY § mini-580)
- [ ] Google Drive ingest
- [ ] Newsletter
- [ ] Commentaires
- [ ] Port aligné **simohra.fr** (clone mini580, branding Simohra)

## Notes opérateur

- **Médias legacy** (~1600 px origin) : « Remplacer le fichier » pour regagner full res
- **Cache front** : hard refresh / navigation privée après deploy éditeur
- **Logs debug save** : console `[photo-editor-trace]` · serveur `[media-trace]`
- **Promotion PROD** : toujours la version exacte validée sur TEST (`/api/version`)
