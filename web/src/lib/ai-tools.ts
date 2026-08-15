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
    | "media_groups"
    | "tags"
    | "themes"
    | "milestones"
    | "memory"
    | "sync"
    | "translate"
    | "users"
    | "account";
};

export const AI_TOOLS: AiToolDef[] = [
  // Posts + FR/EN
  {
    name: "posts.list",
    description:
      "List posts (published public, or paginated editor list when authenticated). Each item includes blogPath, publicUrl, tags (id, name, labelFr/En), themes (id, slug, labels), milestones, tagIds/themeIds/milestoneIds for patches.",
    method: "GET",
    path: "/api/posts",
    auth: "public",
    category: "posts",
  },
  {
    name: "posts.create",
    description:
      "Create a DRAFT post (empty body OK; titles default to Nouvel article / New article). Slug is always auto-generated from titleFr (client slug ignored). Optional publishedAt ISO for timeline/blog ordering; optional workDays (integer, person-days produced for timeline metrics). Returns id, blogPath, publicUrl (null until published) for patches and media.attach / photos.upload.",
    method: "POST",
    path: "/api/posts",
    auth: "bearer_or_session",
    category: "posts",
  },
  {
    name: "posts.get",
    description:
      "Get one post by id. Response includes blogPath, publicUrl, flat tags/themes/milestones (labels + ids), tagIds/themeIds/milestoneIds, and images.",
    method: "GET",
    path: "/api/posts/:id",
    auth: "public",
    category: "posts",
  },
  {
    name: "posts.update",
    description:
      "Patch post FR/EN content, publishedAt, workDays (optional integer — person-days produced, feeds timeline/jalon metrics), authorId (platform editor id), and relations (tags/themes/milestones/hulls). bodyFr/bodyEn accept Markdown: **bold**, ##/### headings, blank-line paragraphs, - bullets, 1. numbered lists (rendered on public blog). Slug is never set manually: while DRAFT it re-syncs from titleFr; once PUBLISHED/ARCHIVED it stays frozen. Returns blogPath + publicUrl.",
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
    description:
      "Publish a draft post. Response includes publicUrl (absolute blog link to share) when status becomes PUBLISHED.",
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
  {
    name: "posts.insert_media_group",
    description:
      "Insert a media group placeholder into post bodyFr/bodyEn — never paste {{media-group:…}} manually. Body: { groupId, lang?: fr|en|both (default both), position?: end|start (default end) }. Group media appear inline on the public article without media.attach.",
    method: "POST",
    path: "/api/posts/:id/insert-media-group",
    auth: "bearer_or_session",
    category: "posts",
  },
  {
    name: "posts.media_manifest",
    description:
      "Unified article media manifest (cover → inline groups in body order → standalone attachments). Query: locale=fr|en.",
    method: "GET",
    path: "/api/posts/:id/media-manifest",
    auth: "public",
    category: "posts",
  },

  // Media groups (médiathèque — independent of posts)
  {
    name: "media_groups.list",
    description:
      "List media groups (paginated). Query: q, limit, offset. Returns { items, total, totalAll } when paginated.",
    method: "GET",
    path: "/api/media-groups",
    auth: "bearer_or_session",
    category: "media_groups",
  },
  {
    name: "media_groups.get",
    description:
      "Get media group detail: ordered members, layout (GRID|ROW|SINGLE), referencedByPostIds.",
    method: "GET",
    path: "/api/media-groups/:id",
    auth: "bearer_or_session",
    category: "media_groups",
  },
  {
    name: "media_groups.create",
    description:
      "Create media group in library. Body: { titleFr?, titleEn?, layout?: GRID|ROW|SINGLE, mediaIds?: string[] }. Slug auto-generated from titleFr (or titleEn); client slug ignored.",
    method: "POST",
    path: "/api/media-groups",
    auth: "bearer_or_session",
    category: "media_groups",
  },
  {
    name: "media_groups.update",
    description:
      "Patch group meta and/or replace ordered members. Body: { titleFr?, titleEn?, layout?, mediaIds?: string[] }. Slug auto-synced from title when titles change.",
    method: "PATCH",
    path: "/api/media-groups/:id",
    auth: "bearer_or_session",
    category: "media_groups",
  },
  {
    name: "media_groups.delete",
    description:
      "Delete group if not referenced in any article body. Returns 409 + referencedByPosts if still used.",
    method: "DELETE",
    path: "/api/media-groups/:id",
    auth: "bearer_or_session",
    category: "media_groups",
  },
  {
    name: "media_groups.references",
    description: "List posts whose bodyFr/bodyEn contain this group's inline placeholder.",
    method: "GET",
    path: "/api/media-groups/:id/references",
    auth: "bearer_or_session",
    category: "media_groups",
  },
  {
    name: "media_groups.add_media",
    description: "Add one media to group at end. Body: { mediaId }.",
    method: "POST",
    path: "/api/media-groups/:id/members",
    auth: "bearer_or_session",
    category: "media_groups",
  },
  {
    name: "media_groups.remove_media",
    description: "Remove media from group (does not delete library item). params: id=groupId, mediaId.",
    method: "DELETE",
    path: "/api/media-groups/:id/members/:mediaId",
    auth: "bearer_or_session",
    category: "media_groups",
  },
  {
    name: "media_groups.reorder",
    description: "Reorder group members. Body: { mediaIds: string[] } — must match current members exactly.",
    method: "PUT",
    path: "/api/media-groups/:id/members/reorder",
    auth: "bearer_or_session",
    category: "media_groups",
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
      "List media library items (paginated). Query: q, kind=IMAGE|DOCUMENT|VIDEO, groupId (filter by media group), limit, offset. Returns { items, total, totalAll }. Media are independent of posts (0–N links).",
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
    description:
      "Patch media FR/EN meta and IMAGE layout: cropAspectFormat (SQUARE|LANDSCAPE_16_9|LANDSCAPE_4_3|PORTRAIT_3_4|CIRCLE), offset/scale/rotation/cropInset/backgroundColor",
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
      "List milestones ordered by milestoneDate then title (locale). Each item: milestoneDate (start), optional endDate (period end; null = punctual deadline), optional workloadForecast (planned person-days), linked posts with workDays. Query: limit, offset, q, locale=fr|en. Paginated → { items, total, totalAll }.",
    method: "GET",
    path: "/api/milestones",
    auth: "public",
    category: "milestones",
  },
  {
    name: "milestones.create",
    description:
      "Create bilingual milestone: titleFr, titleEn, milestoneDate (ISO start), optional endDate (ISO, >= start; omit for punctual deadline), optional workloadForecast (integer person-days), optional descriptionFr/En. Slug auto-generated from titleEn (client slug ignored). Sorted by date then title (no manual order field).",
    method: "POST",
    path: "/api/milestones",
    auth: "bearer_or_session",
    category: "milestones",
  },
  {
    name: "milestones.update",
    description:
      "Update milestone FR/EN titles, descriptions, milestoneDate, endDate, workloadForecast. Slug auto-syncs from titleEn (client slug ignored).",
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

  // Telegram agent long-term memory (rules & knowledge across sessions)
  {
    name: "agent_memory.list",
    description:
      "List persistent agent memory items (title + rule). Query: q, limit, offset. Excludes soft-deleted.",
    method: "GET",
    path: "/api/agent-memory",
    auth: "bearer_or_session",
    category: "memory",
  },
  {
    name: "agent_memory.get",
    description: "Get one agent memory item by id (for update/delete — never tell id to user)",
    method: "GET",
    path: "/api/agent-memory/:id",
    auth: "bearer_or_session",
    category: "memory",
  },
  {
    name: "agent_memory.create",
    description:
      "Create a persistent memory item: body { title, rule }. Use when user asks to remember a rule or important fact for future chats.",
    method: "POST",
    path: "/api/agent-memory",
    auth: "bearer_or_session",
    category: "memory",
  },
  {
    name: "agent_memory.update",
    description: "Patch title and/or rule on a memory item. Body: { title?, rule? }",
    method: "PATCH",
    path: "/api/agent-memory/:id",
    auth: "bearer_or_session",
    category: "memory",
  },
  {
    name: "agent_memory.delete",
    description: "Soft-delete a memory item (removed from future context)",
    method: "DELETE",
    path: "/api/agent-memory/:id",
    auth: "bearer_or_session",
    category: "memory",
  },

  // User management (admin only)
  {
    name: "users.list",
    description:
      "List platform users (ACTIVE + INACTIVE by default; ?includeArchived=true for all). Admin only.",
    method: "GET",
    path: "/api/users",
    auth: "bearer_or_session",
    category: "users",
  },
  {
    name: "users.create",
    description:
      "Create user: { firstName, lastName, email, telegramUserId }. OTP-only until password set. Admin only.",
    method: "POST",
    path: "/api/users",
    auth: "bearer_or_session",
    category: "users",
  },
  {
    name: "users.update",
    description: "Patch user fields (firstName, lastName, email, telegramUserId). Admin only.",
    method: "PATCH",
    path: "/api/users/:id",
    auth: "bearer_or_session",
    category: "users",
  },
  {
    name: "users.deactivate",
    description: "Set user status INACTIVE. Admin only.",
    method: "POST",
    path: "/api/users/:id/deactivate",
    auth: "bearer_or_session",
    category: "users",
  },
  {
    name: "users.archive",
    description: "Set user status ARCHIVED. Admin only.",
    method: "POST",
    path: "/api/users/:id/archive",
    auth: "bearer_or_session",
    category: "users",
  },
  {
    name: "users.setAdmin",
    description: "Set isAdmin flag: { isAdmin: boolean }. Admin only.",
    method: "POST",
    path: "/api/users/:id/set-admin",
    auth: "bearer_or_session",
    category: "users",
  },
  {
    name: "users.invite",
    description:
      "Create PENDING user + invite tag/link for Telegram onboarding. Body: { firstName, lastName, email, isAdmin? }. Returns copyPasteMessage for admin to forward. Admin only.",
    method: "POST",
    path: "/api/users/invite",
    auth: "bearer_or_session",
    category: "users",
  },
  {
    name: "users.webConnect",
    description:
      "Generate 5-minute web auto-login link + OTP fallback for an ACTIVE user. Returns copyPasteMessage (URL + code) for admin to forward via Telegram or mail. Admin only.",
    method: "POST",
    path: "/api/users/:id/web-connect",
    auth: "bearer_or_session",
    category: "users",
  },

  // Self-service account (own profile only — all ACTIVE editors)
  {
    name: "account.me",
    description:
      "Get your own platform account (name, email, status). Never lists other users.",
    method: "GET",
    path: "/api/account/me",
    auth: "bearer_or_session",
    category: "account",
  },
  {
    name: "account.update",
    description:
      "Update your own profile: { firstName?, lastName?, email? }. Cannot change Telegram id, status, or admin flag.",
    method: "PATCH",
    path: "/api/account/me",
    auth: "bearer_or_session",
    category: "account",
  },
  {
    name: "account.webConnect",
    description:
      "Generate a 5-minute web auto-login link + OTP fallback for yourself. Returns copyPasteMessage.",
    method: "POST",
    path: "/api/account/web-connect",
    auth: "bearer_or_session",
    category: "account",
  },
  {
    name: "account.otpLogin",
    description:
      "Send a 4-digit login OTP to your Telegram for web login at /connexion (Code Telegram tab).",
    method: "POST",
    path: "/api/account/otp/login",
    auth: "bearer_or_session",
    category: "account",
  },
  {
    name: "account.otpPasswordReset",
    description:
      "Send a 4-digit OTP to your Telegram to reset your web password.",
    method: "POST",
    path: "/api/account/otp/password-reset",
    auth: "bearer_or_session",
    category: "account",
  },
  {
    name: "account.setPassword",
    description:
      "Set a new web password using PASSWORD_RESET OTP: { code, newPassword } (min 8 chars).",
    method: "POST",
    path: "/api/account/password",
    auth: "bearer_or_session",
    category: "account",
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
