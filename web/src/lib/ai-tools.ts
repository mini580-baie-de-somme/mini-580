/**
 * HTTP tool surface for OpenClaw / Cursor agents (Bearer INGEST_API_KEY or session).
 * Each tool maps 1:1 to an API route used by the IA chat capacity suite.
 */
export type AiToolMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type AiToolDef = {
  name: string;
  description: string;
  method: AiToolMethod;
  /** Path template with `:id`, `:imageId`, `:milestoneId` placeholders */
  path: string;
  auth: "bearer_or_session" | "session" | "public" | "sync_otp";
  category:
    | "posts"
    | "photos"
    | "media"
    | "tags"
    | "themes"
    | "milestones"
    | "sync"
    | "translate";
};

export const AI_TOOLS: AiToolDef[] = [
  // Posts + FR/EN
  {
    name: "posts.list",
    description: "List posts (published public, or all when authenticated)",
    method: "GET",
    path: "/api/posts",
    auth: "public",
    category: "posts",
  },
  {
    name: "posts.create",
    description:
      "Create a DRAFT post (empty body OK; titles default to Nouvel article / New article). Slug is always auto-generated from titleFr (client slug ignored). Optional publishedAt ISO for timeline/blog ordering. Returns id for patches and media.attach / photos.upload.",
    method: "POST",
    path: "/api/posts",
    auth: "bearer_or_session",
    category: "posts",
  },
  {
    name: "posts.get",
    description: "Get one post by id",
    method: "GET",
    path: "/api/posts/:id",
    auth: "public",
    category: "posts",
  },
  {
    name: "posts.update",
    description:
      "Patch post FR/EN content, publishedAt, and relations (tags/themes/milestones/hulls). Slug is never set manually: while DRAFT it re-syncs from titleFr; once PUBLISHED/ARCHIVED it stays frozen.",
    method: "PATCH",
    path: "/api/posts/:id",
    auth: "bearer_or_session",
    category: "posts",
  },
  {
    name: "posts.delete",
    description: "Delete a post",
    method: "DELETE",
    path: "/api/posts/:id",
    auth: "bearer_or_session",
    category: "posts",
  },
  {
    name: "posts.publish",
    description: "Publish a draft post",
    method: "POST",
    path: "/api/posts/:id/publish",
    auth: "bearer_or_session",
    category: "posts",
  },
  {
    name: "posts.archive",
    description: "Archive a post",
    method: "POST",
    path: "/api/posts/:id/archive",
    auth: "bearer_or_session",
    category: "posts",
  },

  // Public gallery + media library + legacy photo aliases
  {
    name: "gallery.list",
    description:
      "Public multi-media gallery (IMAGE|DOCUMENT|VIDEO) linked to published posts. Query: hull, theme, tag, milestone, search, kind, sort=date|milestone",
    method: "GET",
    path: "/api/gallery",
    auth: "public",
    category: "media",
  },
  {
    name: "media.list",
    description:
      "List media library items (paginated). Query: q, kind=IMAGE|DOCUMENT|VIDEO, limit, offset. Returns { items, total, totalAll }. Media are independent of posts (0–N links).",
    method: "GET",
    path: "/api/media-library",
    auth: "bearer_or_session",
    category: "media",
  },
  {
    name: "media.get",
    description: "Get one media library item by id (includes linked posts)",
    method: "GET",
    path: "/api/media-library/:id",
    auth: "bearer_or_session",
    category: "media",
  },
  {
    name: "media.create",
    description:
      "Create media in the library (multipart file OR JSON { urlOrigin, kind?, titleFr/En }). IMAGE → variants; DOCUMENT/VIDEO → origin only. Does not attach to a post.",
    method: "POST",
    path: "/api/media-library",
    auth: "bearer_or_session",
    category: "media",
  },
  {
    name: "media.update",
    description: "Patch media FR/EN meta and IMAGE transforms (focus/zoom/rotate/crop)",
    method: "PATCH",
    path: "/api/media-library/:id",
    auth: "bearer_or_session",
    category: "media",
  },
  {
    name: "media.replace",
    description: "Replace media file (multipart). IMAGE regenerates variants.",
    method: "POST",
    path: "/api/media-library/:id/replace",
    auth: "bearer_or_session",
    category: "media",
  },
  {
    name: "media.delete",
    description:
      "Delete media from library. If linked to posts, pass ?force=1. Prefer media.detach to only unlink.",
    method: "DELETE",
    path: "/api/media-library/:id",
    auth: "bearer_or_session",
    category: "media",
  },
  {
    name: "media.attach",
    description:
      "Attach mediaIds to a post, OR upload multipart and attach, OR JSON { urlOrigin }. Body: { mediaIds, setCoverFirst? }",
    method: "POST",
    path: "/api/posts/:id/media",
    auth: "bearer_or_session",
    category: "media",
  },
  {
    name: "media.list_for_post",
    description: "List media linked to a post (all kinds), ordered by sortOrder",
    method: "GET",
    path: "/api/posts/:id/media",
    auth: "public",
    category: "media",
  },
  {
    name: "media.detach",
    description: "Detach media from a post only (does NOT delete library item)",
    method: "DELETE",
    path: "/api/posts/:id/media/:mediaId",
    auth: "bearer_or_session",
    category: "media",
  },
  {
    name: "media.reorder",
    description: "Reorder media on a post. Body: { mediaIds: string[] }",
    method: "PUT",
    path: "/api/posts/:id/media/reorder",
    auth: "bearer_or_session",
    category: "media",
  },
  {
    name: "media.set_cover",
    description: "Mark linked media as post cover",
    method: "POST",
    path: "/api/posts/:id/media/:mediaId/cover",
    auth: "bearer_or_session",
    category: "media",
  },
  {
    name: "media.put",
    description: "Raw bucket upload (no DB row) — prefer media.create / media.attach",
    method: "POST",
    path: "/api/media",
    auth: "bearer_or_session",
    category: "media",
  },
  {
    name: "photos.list",
    description: "[compat] List post media — prefer media.list_for_post",
    method: "GET",
    path: "/api/posts/:id/images",
    auth: "public",
    category: "photos",
  },
  {
    name: "photos.upload",
    description: "[compat] Upload/attach image to post — prefer media.attach",
    method: "POST",
    path: "/api/posts/:id/images",
    auth: "bearer_or_session",
    category: "photos",
  },
  {
    name: "photos.replace_all",
    description: "[compat] Replace all post media links",
    method: "PUT",
    path: "/api/posts/:id/images",
    auth: "bearer_or_session",
    category: "photos",
  },
  {
    name: "photos.patch",
    description: "[compat] Update media meta — prefer media.update",
    method: "PATCH",
    path: "/api/posts/:id/images/:imageId",
    auth: "bearer_or_session",
    category: "photos",
  },
  {
    name: "photos.replace_file",
    description: "[compat] Replace image file — prefer media.replace",
    method: "POST",
    path: "/api/posts/:id/images/:imageId/replace",
    auth: "bearer_or_session",
    category: "photos",
  },
  {
    name: "photos.reorder",
    description: "[compat] Reorder — prefer media.reorder with mediaIds",
    method: "PUT",
    path: "/api/posts/:id/images/reorder",
    auth: "bearer_or_session",
    category: "photos",
  },
  {
    name: "photos.delete",
    description: "[compat] Detach+delete orphan — prefer media.detach / media.delete",
    method: "DELETE",
    path: "/api/posts/:id/images/:imageId",
    auth: "bearer_or_session",
    category: "photos",
  },

  // Tags
  {
    name: "tags.list",
    description: "List tags (array) or paginated ?limit&offset&q → { items, total, totalAll }",
    method: "GET",
    path: "/api/tags",
    auth: "public",
    category: "tags",
  },
  {
    name: "tags.create",
    description: "Create bilingual tag (labelFr, labelEn, optional name)",
    method: "POST",
    path: "/api/tags",
    auth: "bearer_or_session",
    category: "tags",
  },
  {
    name: "tags.update",
    description: "Update tag FR/EN labels or identifier",
    method: "PATCH",
    path: "/api/tags/:id",
    auth: "bearer_or_session",
    category: "tags",
  },
  {
    name: "tags.delete",
    description: "Delete a tag (unlinks from posts)",
    method: "DELETE",
    path: "/api/tags/:id",
    auth: "bearer_or_session",
    category: "tags",
  },

  // Themes
  {
    name: "themes.list",
    description: "List themes (array) or paginated ?limit&offset&q → { items, total, totalAll }",
    method: "GET",
    path: "/api/themes",
    auth: "public",
    category: "themes",
  },
  {
    name: "themes.create",
    description: "Create bilingual theme (labelFr, labelEn, optional slug)",
    method: "POST",
    path: "/api/themes",
    auth: "bearer_or_session",
    category: "themes",
  },
  {
    name: "themes.update",
    description: "Update theme FR/EN labels or slug",
    method: "PATCH",
    path: "/api/themes/:id",
    auth: "bearer_or_session",
    category: "themes",
  },
  {
    name: "themes.delete",
    description: "Delete a theme (unlinks from posts)",
    method: "DELETE",
    path: "/api/themes/:id",
    auth: "bearer_or_session",
    category: "themes",
  },

  // Milestones
  {
    name: "milestones.list",
    description:
      "List milestones ordered by milestoneDate then title (locale). Query: limit, offset, q, locale=fr|en. Paginated → { items, total, totalAll }.",
    method: "GET",
    path: "/api/milestones",
    auth: "public",
    category: "milestones",
  },
  {
    name: "milestones.create",
    description:
      "Create bilingual milestone: titleFr, titleEn, milestoneDate (ISO), optional descriptionFr/En and slug. Sorted by date then title (no manual order field).",
    method: "POST",
    path: "/api/milestones",
    auth: "bearer_or_session",
    category: "milestones",
  },
  {
    name: "milestones.update",
    description:
      "Update milestone FR/EN titles, descriptions, milestoneDate, optional slug.",
    method: "PATCH",
    path: "/api/milestones/:id",
    auth: "bearer_or_session",
    category: "milestones",
  },
  {
    name: "milestones.delete",
    description: "Delete a milestone (unlinks from posts)",
    method: "DELETE",
    path: "/api/milestones/:id",
    auth: "bearer_or_session",
    category: "milestones",
  },

  // Sync
  {
    name: "sync.status",
    description: "Compare local vs peer posts/milestones",
    method: "GET",
    path: "/api/sync/status",
    auth: "session",
    category: "sync",
  },
  {
    name: "sync.pull_from_prod",
    description: "Pull PROD catalog + posts into TEST",
    method: "POST",
    path: "/api/sync/pull-from-prod",
    auth: "session",
    category: "sync",
  },
  {
    name: "sync.publish_to_prod",
    description: "Publish a TEST post to PROD",
    method: "POST",
    path: "/api/sync/publish-to-prod",
    auth: "session",
    category: "sync",
  },
  {
    name: "sync.publish_milestone_to_prod",
    description: "Publish a TEST milestone to PROD",
    method: "POST",
    path: "/api/sync/publish-milestone-to-prod",
    auth: "session",
    category: "sync",
  },
  {
    name: "sync.catalog",
    description: "Pull or push tags/themes/milestones catalog",
    method: "POST",
    path: "/api/sync/catalog",
    auth: "session",
    category: "sync",
  },
  {
    name: "sync.peer_export",
    description: "Peer OTP export (machine)",
    method: "GET",
    path: "/api/sync/peer/export",
    auth: "sync_otp",
    category: "sync",
  },
  {
    name: "sync.peer_import",
    description: "Peer OTP import (machine)",
    method: "PUT",
    path: "/api/sync/peer/import",
    auth: "sync_otp",
    category: "sync",
  },

  // Translate assist
  {
    name: "translate",
    description: "IA-assisted FR→EN for article or image metas",
    method: "POST",
    path: "/api/translate",
    auth: "bearer_or_session",
    category: "translate",
  },

  // Preview links (Telegram / share)
  {
    name: "preview.create",
    description:
      "Create a temporary shareable draft preview URL (/apercu/t/:token, 72h)",
    method: "POST",
    path: "/api/posts/:id/preview",
    auth: "bearer_or_session",
    category: "posts",
  },
];

export function aiToolsByCategory(category: AiToolDef["category"]): AiToolDef[] {
  return AI_TOOLS.filter((t) => t.category === category);
}

export function resolveToolPath(
  path: string,
  params: Record<string, string>
): string {
  return path.replace(/:([a-zA-Z]+)/g, (_, key: string) => {
    const val = params[key];
    if (!val) throw new Error(`Missing path param :${key} for ${path}`);
    return encodeURIComponent(val);
  });
}
