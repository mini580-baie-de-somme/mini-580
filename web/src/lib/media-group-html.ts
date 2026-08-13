/** HTML attribute for TipTap / turndown round-trip of media group blocks. */
export const MEDIA_GROUP_HTML_ATTR = "data-media-group-id";

export function mediaGroupHtml(groupId: string): string {
  // Zero-width space keeps Turndown from treating the block as blank.
  return `<div ${MEDIA_GROUP_HTML_ATTR}="${groupId}" data-type="media-group-block">\u200B</div>`;
}
