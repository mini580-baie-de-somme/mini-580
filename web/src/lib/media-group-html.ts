/** HTML attribute for TipTap / turndown round-trip of media group blocks. */
export const MEDIA_GROUP_HTML_ATTR = "data-media-group-id";

/** Inner text so Turndown does not treat the block as blank (see blankRule). */
export const MEDIA_GROUP_HTML_INNER = "\u200B";

export function mediaGroupHtml(groupId: string): string {
  return `<div ${MEDIA_GROUP_HTML_ATTR}="${groupId}" data-type="media-group-block">${MEDIA_GROUP_HTML_INNER}</div>`;
}
