/** Matches canonical `{{media-group:id}}` and editor sur-charge `{{media-group:id|title|count}}`. */
export const MEDIA_GROUP_TOKEN_RE =
  /\{\{media-group:([a-z0-9]+)(?:\|[^|]*\|\d+)?\}\}/gi;

/** @deprecated Use MEDIA_GROUP_TOKEN_RE — kept for imports that expect this name. */
export const MEDIA_GROUP_PLACEHOLDER_RE = MEDIA_GROUP_TOKEN_RE;

/** Canonical token stored in Post.bodyFr / bodyEn (id only). */
export function mediaGroupPlaceholder(groupId: string): string {
  return `{{media-group:${groupId}}}`;
}

export type MediaGroupTokenMeta = {
  titleFr?: string | null;
  titleEn?: string | null;
  slug?: string | null;
  memberCount: number;
};

/** Editor sur-charge: title + count for readability (stripped on save). */
export function mediaGroupEnrichedPlaceholder(
  groupId: string,
  title: string,
  memberCount: number
): string {
  const safeTitle = title.replace(/\|/g, "·").trim() || "…";
  return `{{media-group:${groupId}|${safeTitle}|${memberCount}}}`;
}

/** Strip sur-charge — keep id-only tokens for persistence and public rendering. */
export function cleanMediaGroupTokens(body: string): string {
  if (!body) return body;
  const re = new RegExp(MEDIA_GROUP_TOKEN_RE.source, "gi");
  return body.replace(re, (_match, groupId: string) =>
    mediaGroupPlaceholder(groupId)
  );
}

/** Inject live title + member count into body tokens (editor display only). */
export function enrichMediaGroupTokens(
  body: string,
  metaById: Record<string, MediaGroupTokenMeta | null | undefined>,
  locale: "fr" | "en",
  resolveName: (
    meta: MediaGroupTokenMeta,
    loc: "fr" | "en",
    id: string
  ) => string
): string {
  if (!body) return body;
  const re = new RegExp(MEDIA_GROUP_TOKEN_RE.source, "gi");
  return body.replace(re, (match, groupId: string) => {
    const meta = metaById[groupId];
    if (!meta) return match;
    const title = resolveName(meta, locale, groupId);
    return mediaGroupEnrichedPlaceholder(groupId, title, meta.memberCount);
  });
}

/** Extract unique MediaGroup ids in document order (ignores sur-charge fields). */
export function parseMediaGroupIds(body: string): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const match of body.matchAll(
    new RegExp(MEDIA_GROUP_TOKEN_RE.source, "gi")
  )) {
    const id = match[1];
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}
