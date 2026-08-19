/** Matches canonical `{{external-link:id}}` placeholders in article bodies. */
export const EXTERNAL_LINK_TOKEN_RE = /\{\{external-link:([a-z0-9]+)\}\}/gi;

/** Canonical token stored in Post.bodyFr / bodyEn (id only). */
export function externalLinkPlaceholder(linkId: string): string {
  return `{{external-link:${linkId}}}`;
}

/** Extract unique ExternalLink ids in document order. */
export function parseExternalLinkIds(body: string): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const match of body.matchAll(
    new RegExp(EXTERNAL_LINK_TOKEN_RE.source, "gi")
  )) {
    const id = match[1];
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

export function resolveExternalLinkUrl(
  link: {
    url?: string | null;
    urlFr?: string | null;
    urlEn?: string | null;
  },
  locale: "fr" | "en"
): string {
  if (link.url?.trim()) return link.url.trim();
  return locale === "fr"
    ? (link.urlFr?.trim() ?? "")
    : (link.urlEn?.trim() ?? "");
}
