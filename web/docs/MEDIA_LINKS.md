# Media links model (chantier 1+)

Since chantier 1 (2026-08-20), valid media↔article relationships are:

1. **Article header / cover** — `PostMedia` with `isCover: true`
2. **Article body** — only via `MediaGroupMember` (inline media groups in content)

## Legacy (non-blocking)

`PostMedia` rows with `isCover: false` are **legacy orphans** from the removed standalone gallery. They are:

- Purged by migration `20260821100000_purge_legacy_post_media`
- Auto-cleaned on `DELETE /api/media-library/:id` before the media row is removed
- **Not blocking** — delete proceeds without `force=1`

## Delete confirmation modal

When deleting from the media library (`MediaLibraryManager`), the modal shows:

- **Cover/header links** — articles where this media is the cover (`coverLinks`)
- **Media groups** — groups that include this media (`groups`)
- **Legacy note** — count of obsolete post links that will be cleaned automatically

If only legacy links exist, deletion is allowed without confirmation escalation.

## API

`DELETE /api/media-library/:id`:

- Returns **409** with `links: { coverLinks, groups, legacyPostLinkCount }` when blocking links exist and `force` is not set
- `force=1` confirms deletion despite cover/group links

## Code

| File | Role |
|------|------|
| `web/src/lib/media-links.ts` | `extractMediaLinkInfo`, `hasBlockingMediaLinks` |
| `web/src/components/MediaDeleteConfirmMessage.tsx` | Structured modal body |
| `web/src/lib/media-library.ts` | `deleteMediaById` — legacy purge + delete |

See also: `docs/12-photo-editor-medias.md`, `docs/13-article-image-groups.md`.
