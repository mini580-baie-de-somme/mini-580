/** Matches canonical `{{external-link:id}}` and editor sur-charge `{{external-link:id|label|url}}`. */
export const EXTERNAL_LINK_TOKEN_RE =
  /\{\{external-link:([a-z0-9]+)(?:\|[^|]*\|[^}]*)?\}\}/gi;

/** Canonical token stored in Post.bodyFr / bodyEn (id only). */
export function externalLinkPlaceholder(linkId: string): string {
  return `{{external-link:${linkId}}}`;
}

export type ExternalLinkTokenMeta = {
  labelFr?: string | null;
  labelEn?: string | null;
  url?: string | null;
  urlFr?: string | null;
  urlEn?: string | null;
};

/** Editor sur-charge: label + url for readability (stripped on save). */
export function externalLinkEnrichedPlaceholder(
  linkId: string,
  label: string,
  urlDisplay: string
): string {
  const safeLabel = label.replace(/\|/g, "·").trim() || "…";
  const safeUrl = urlDisplay.replace(/\|/g, "·").trim() || "…";
  return `{{external-link:${linkId}|${safeLabel}|${safeUrl}}}`;
}

/** Strip sur-charge — keep id-only tokens for persistence and public rendering. */
export function cleanExternalLinkTokens(body: string): string {
  if (!body) return body;
  const re = new RegExp(EXTERNAL_LINK_TOKEN_RE.source, "gi");
  return body.replace(re, (_match, linkId: string) =>
    externalLinkPlaceholder(linkId)
  );
}

/** Inject live label + url into body tokens (editor display only). */
export function enrichExternalLinkTokens(
  body: string,
  metaById: Record<string, ExternalLinkTokenMeta | null | undefined>,
  locale: "fr" | "en",
  resolveLabel: (
    meta: ExternalLinkTokenMeta,
    loc: "fr" | "en",
    id: string
  ) => string
): string {
  if (!body) return body;
  const re = new RegExp(EXTERNAL_LINK_TOKEN_RE.source, "gi");
  return body.replace(re, (match, linkId: string) => {
    const meta = metaById[linkId];
    if (!meta) return match;
    const label = resolveLabel(meta, locale, linkId);
    const url = resolveExternalLinkUrl(meta, locale) || "…";
    return externalLinkEnrichedPlaceholder(linkId, label, url);
  });
}

/** Extract unique ExternalLink ids in document order (ignores sur-charge fields). */
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
