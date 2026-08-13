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

  it("round-trips media group placeholders through HTML", () => {
    const md =
      "Intro paragraph.\n\n{{media-group:clgroup123abc}}\n\nOutro **bold**.";
    const html = markdownToHtml(md);
    expect(html).toContain('data-media-group-id="clgroup123abc"');
    const back = htmlToMarkdown(html);
    expect(back).toContain("{{media-group:clgroup123abc}}");
    expect(back).toContain("Intro paragraph");
    expect(back).toContain("**bold**");
  });

  it("converts TipTap renderHTML output for media groups to placeholders", () => {
    const tiptapHtml =
      '<p>Intro</p><div data-media-group-id="clgroup123abc" data-type="media-group-block"></div><p>Outro</p>';
    const back = htmlToMarkdown(tiptapHtml);
    expect(back).toContain("{{media-group:clgroup123abc}}");
    expect(back).toContain("Intro");
    expect(back).toContain("Outro");
  });

  it("converts nested NodeView DOM (without outer attr) via inner data-media-group-id", () => {
    const nodeViewHtml =
      '<p>Intro</p><div class="my-3"><div contenteditable="false" data-media-group-id="clgroup123abc">chip</div></div><p>Outro</p>';
    const back = htmlToMarkdown(nodeViewHtml);
    expect(back).toContain("{{media-group:clgroup123abc}}");
  });
});
