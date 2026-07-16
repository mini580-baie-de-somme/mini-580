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
      "Create a DRAFT post immediately (empty body OK; titles default to Nouvel article / New article). Returns id to reuse for patches and photos.",
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
    description: "Patch post FR/EN content and relations",
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

  // Photos + FR/EN + transforms + 4 sizes
  {
    name: "gallery.list",
    description:
      "Public yard gallery: published post photos filtered by hull/theme/tag/milestone/search, sorted by date or milestone",
    method: "GET",
    path: "/api/gallery",
    auth: "public",
    category: "photos",
  },
  {
    name: "photos.list",
    description: "List images for a post",
    method: "GET",
    path: "/api/posts/:id/images",
    auth: "public",
    category: "photos",
  },
  {
    name: "media.put",
    description: "Raw bucket upload (single object, e.g. cover) — no variants",
    method: "POST",
    path: "/api/media",
    auth: "bearer_or_session",
    category: "photos",
  },
  {
    name: "photos.upload",
    description: "Upload image (multipart) → origin + picto/petite/moyenne/grande",
    method: "POST",
    path: "/api/posts/:id/images",
    auth: "bearer_or_session",
    category: "photos",
  },
  {
    name: "photos.replace_all",
    description: "Replace all post images metadata/URLs",
    method: "PUT",
    path: "/api/posts/:id/images",
    auth: "bearer_or_session",
    category: "photos",
  },
  {
    name: "photos.patch",
    description: "Update FR/EN meta + move/zoom/rotate/crop transforms",
    method: "PATCH",
    path: "/api/posts/:id/images/:imageId",
    auth: "bearer_or_session",
    category: "photos",
  },
  {
    name: "photos.replace_file",
    description: "Replace origin file and regenerate 4 WebP sizes",
    method: "POST",
    path: "/api/posts/:id/images/:imageId/replace",
    auth: "bearer_or_session",
    category: "photos",
  },
  {
    name: "photos.reorder",
    description: "Reorder post images",
    method: "PUT",
    path: "/api/posts/:id/images/reorder",
    auth: "bearer_or_session",
    category: "photos",
  },
  {
    name: "photos.delete",
    description: "Delete an image and media files",
    method: "DELETE",
    path: "/api/posts/:id/images/:imageId",
    auth: "bearer_or_session",
    category: "photos",
  },

  // Tags
  {
    name: "tags.list",
    description: "List tags",
    method: "GET",
    path: "/api/tags",
    auth: "public",
    category: "tags",
  },
  {
    name: "tags.create",
    description: "Create bilingual tag",
    method: "POST",
    path: "/api/tags",
    auth: "bearer_or_session",
    category: "tags",
  },
  {
    name: "tags.update",
    description: "Update tag FR/EN",
    method: "PATCH",
    path: "/api/tags/:id",
    auth: "bearer_or_session",
    category: "tags",
  },
  {
    name: "tags.delete",
    description: "Delete tag",
    method: "DELETE",
    path: "/api/tags/:id",
    auth: "bearer_or_session",
    category: "tags",
  },

  // Themes
  {
    name: "themes.list",
    description: "List themes",
    method: "GET",
    path: "/api/themes",
    auth: "public",
    category: "themes",
  },
  {
    name: "themes.create",
    description: "Create bilingual theme",
    method: "POST",
    path: "/api/themes",
    auth: "bearer_or_session",
    category: "themes",
  },
  {
    name: "themes.update",
    description: "Update theme FR/EN",
    method: "PATCH",
    path: "/api/themes/:id",
    auth: "bearer_or_session",
    category: "themes",
  },
  {
    name: "themes.delete",
    description: "Delete theme",
    method: "DELETE",
    path: "/api/themes/:id",
    auth: "bearer_or_session",
    category: "themes",
  },

  // Milestones (jalons timeline)
  {
    name: "milestones.list",
    description: "List timeline milestones",
    method: "GET",
    path: "/api/milestones",
    auth: "public",
    category: "milestones",
  },
  {
    name: "milestones.create",
    description: "Create bilingual milestone",
    method: "POST",
    path: "/api/milestones",
    auth: "bearer_or_session",
    category: "milestones",
  },
  {
    name: "milestones.update",
    description: "Update milestone FR/EN",
    method: "PATCH",
    path: "/api/milestones/:id",
    auth: "bearer_or_session",
    category: "milestones",
  },
  {
    name: "milestones.delete",
    description: "Delete milestone",
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
