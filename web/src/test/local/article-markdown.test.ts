import { describe, expect, it } from "vitest";

import {
  htmlToMarkdown,
  markdownToHtml,
  normalizeLegacyBodyText,
} from "@/lib/article-markdown";

describe("article-markdown", () => {
  it("renders bold, headings, and lists to HTML", () => {
    const md = "## Titre\n\n**gras** et texte\n\n- un\n- deux\n\n1. a\n2. b";
    const html = markdownToHtml(md);
    expect(html).toContain("<h2");
    expect(html).toContain("<strong>gras</strong>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<ol>");
  });

  it("round-trips common formatting through HTML", () => {
    const md = "## Section\n\n**Bold** line\n\n- alpha\n- beta";
    const back = htmlToMarkdown(markdownToHtml(md));
    expect(back).toContain("## Section");
    expect(back).toContain("**Bold**");
    expect(back).toMatch(/- alpha/);
    expect(back).toMatch(/- beta/);
  });

  it("preserves legacy plain paragraphs", () => {
    const legacy = "Premier paragraphe.\n\nDeuxième paragraphe.";
    expect(normalizeLegacyBodyText(legacy)).toBe(legacy);
    const html = markdownToHtml(legacy);
    expect(html).toContain("<p");
  });
});
