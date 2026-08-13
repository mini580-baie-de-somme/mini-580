/** Canonical inline placeholder stored in Post.bodyFr / bodyEn (never typed by users). */
export const MEDIA_GROUP_PLACEHOLDER_RE =
  /\{\{media-group:([a-z0-9]+)\}\}/gi;

export function mediaGroupPlaceholder(groupId: string): string {
  return `{{media-group:${groupId}}}`;
}

/** Extract unique MediaGroup ids in document order. */
export function parseMediaGroupIds(body: string): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const match of body.matchAll(new RegExp(MEDIA_GROUP_PLACEHOLDER_RE.source, "gi"))) {
    const id = match[1];
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}
