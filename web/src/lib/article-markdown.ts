import { marked } from "marked";
import TurndownService from "turndown";
import { parseArticleBodySegments } from "@/lib/article-body-segments";
import { mediaGroupPlaceholder } from "@/lib/media-group-token";
import {
  mediaGroupHtml,
  MEDIA_GROUP_HTML_ATTR,
  MEDIA_GROUP_HTML_INNER,
} from "@/lib/media-group-html";

/** Supported Markdown subset for article bodies (FR/EN). */
export const ARTICLE_MARKDOWN_HELP = {
  fr: [
    "**gras** — texte en gras",
    "## Titre — titre de section (## ou ###)",
    "Paragraphe — séparer par une ligne vide",
    "- item — liste à puces",
    "1. item — liste numérotée",
  ],
  en: [
    "**bold** — bold text",
    "## Heading — section title (## or ###)",
    "Paragraph — separate with a blank line",
    "- item — bullet list",
    "1. item — numbered list",
  ],
} as const;

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  emDelimiter: "*",
  strongDelimiter: "**",
});

turndown.addRule("paragraphSpacing", {
  filter: "p",
  replacement(content) {
    const trimmed = content.trim();
    return trimmed ? `\n\n${trimmed}\n\n` : "";
  },
});

turndown.addRule("mediaGroupBlock", {
  filter(node) {
    return (
      node.nodeName === "DIV" &&
      (node as HTMLElement).getAttribute(MEDIA_GROUP_HTML_ATTR) != null
    );
  },
  replacement(_content, node) {
    const id = (node as HTMLElement).getAttribute(MEDIA_GROUP_HTML_ATTR);
    if (!id) return "";
    return `\n\n${mediaGroupPlaceholder(id)}\n\n`;
  },
});
marked.setOptions({
  gfm: true,
  breaks: false,
});

/** Convert stored Markdown to HTML for the visual editor. */
export function markdownToHtml(markdown: string): string {
  const source = markdown.trim();
  if (!source) return "";

  const segments = parseArticleBodySegments(source);
  const hasGroups = segments.some((segment) => segment.type === "media-group");
  if (!hasGroups) {
    const html = marked.parse(source, { async: false }) as string;
    return html.trim();
  }

  const parts = segments
    .map((segment) => {
      if (segment.type === "media-group") {
        return mediaGroupHtml(segment.groupId);
      }
      const text = segment.content.trim();
      if (!text) return "";
      return marked.parse(text, { async: false }) as string;
    })
    .filter(Boolean);

  return parts.join("\n").trim();
}

/** Ensure empty media-group divs are not treated as blank by Turndown. */
function normalizeMediaGroupHtml(html: string): string {
  const emptyDivRe = new RegExp(
    `(<div\\s+[^>]*${MEDIA_GROUP_HTML_ATTR}="[^"]+"[^>]*>)\\s*</div>`,
    "gi"
  );
  return html.replace(emptyDivRe, `$1${MEDIA_GROUP_HTML_INNER}</div>`);
}

/** Convert visual editor HTML back to Markdown for storage. */
export function htmlToMarkdown(html: string): string {
  const source = html.trim();
  if (!source) return "";
  return turndown
    .turndown(normalizeMediaGroupHtml(source))
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^(\s*-\s+)\s+/gm, "- ")
    .replace(/^(\d+\.)\s+/gm, "$1 ")
    .trim();
}

/** Normalize plain-text legacy bodies to Markdown-friendly paragraphs. */
export function normalizeLegacyBodyText(text: string): string {
  return text.replace(/\r\n/g, "\n").trimEnd();
}
