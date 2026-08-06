import { marked } from "marked";
import TurndownService from "turndown";

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

marked.setOptions({
  gfm: true,
  breaks: false,
});

/** Convert stored Markdown to HTML for the visual editor. */
export function markdownToHtml(markdown: string): string {
  const source = markdown.trim();
  if (!source) return "";
  const html = marked.parse(source, { async: false }) as string;
  return html.trim();
}

/** Convert visual editor HTML back to Markdown for storage. */
export function htmlToMarkdown(html: string): string {
  const source = html.trim();
  if (!source) return "";
  return turndown
    .turndown(source)
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^(\s*-\s+)\s+/gm, "- ")
    .replace(/^(\d+\.)\s+/gm, "$1 ")
    .trim();
}

/** Normalize plain-text legacy bodies to Markdown-friendly paragraphs. */
export function normalizeLegacyBodyText(text: string): string {
  return text.replace(/\r\n/g, "\n").trimEnd();
}
