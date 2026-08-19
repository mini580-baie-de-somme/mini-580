/** HTML attribute for TipTap / turndown round-trip of external link blocks. */
export const EXTERNAL_LINK_HTML_ATTR = "data-external-link-id";

/** Inner text so Turndown does not treat the block as blank (see blankRule). */
export const EXTERNAL_LINK_HTML_INNER = "\u200B";

export function externalLinkHtml(linkId: string): string {
  return `<div ${EXTERNAL_LINK_HTML_ATTR}="${linkId}" data-type="external-link-block">${EXTERNAL_LINK_HTML_INNER}</div>`;
}
