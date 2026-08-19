import { describe, expect, it } from "vitest";
import { parseArticleBodySegments } from "@/lib/article-body-segments";
import { mediaGroupPlaceholder } from "@/lib/media-group-token";

describe("parseArticleBodySegments", () => {
  it("returns single text segment when no placeholders", () => {
    expect(parseArticleBodySegments("Hello **world**")).toEqual([
      { type: "text", content: "Hello **world**" },
    ]);
  });

  it("splits text, media-group, and external-link placeholders in document order", () => {
    const groupA = "clgroupaaa111";
    const linkB = "cllinkbbb222";
    const body = [
      "Intro paragraph.",
      "",
      mediaGroupPlaceholder(groupA),
      "",
      "Middle text.",
      "",
      `{{external-link:${linkB}}}`,
      "",
      "Outro.",
    ].join("\n");

    const segments = parseArticleBodySegments(body);
    expect(segments).toEqual([
      { type: "text", content: "Intro paragraph.\n\n" },
      { type: "media-group", groupId: groupA },
      { type: "text", content: "\n\nMiddle text.\n\n" },
      { type: "external-link", linkId: linkB },
      { type: "text", content: "\n\nOutro." },
    ]);
  });

  it("parses enriched external-link tokens (editor sur-charge)", () => {
    const linkId = "cllinkenriched";
    const body = `Intro\n{{external-link:${linkId}|Teste|https://classmini580.blog}}\nOutro`;
    expect(parseArticleBodySegments(body)).toEqual([
      { type: "text", content: "Intro\n" },
      { type: "external-link", linkId },
      { type: "text", content: "\nOutro" },
    ]);
  });

  it("handles FR and EN bodies with different group positions", () => {
    const g1 = "grp001";
    const g2 = "grp002";
    const bodyFr = `Fr intro\n${mediaGroupPlaceholder(g1)}\nFr outro`;
    const bodyEn = `${mediaGroupPlaceholder(g2)}\nEn intro`;

    expect(parseArticleBodySegments(bodyFr).map((s) => s.type)).toEqual([
      "text",
      "media-group",
      "text",
    ]);
    expect(parseArticleBodySegments(bodyEn).map((s) => s.type)).toEqual([
      "media-group",
      "text",
    ]);
  });
});
