import { describe, expect, it } from "vitest";
import { resolveExternalLinkDisplayName } from "@/lib/external-link-display";
import {
  cleanExternalLinkTokens,
  enrichExternalLinkTokens,
  externalLinkEnrichedPlaceholder,
  externalLinkPlaceholder,
  parseExternalLinkIds,
  resolveExternalLinkUrl,
} from "@/lib/external-link-token";

describe("external-link-token", () => {
  it("builds canonical placeholder", () => {
    expect(externalLinkPlaceholder("cllink123")).toBe("{{external-link:cllink123}}");
  });

  it("parses canonical and enriched tokens", () => {
    const body =
      "{{external-link:abc123}}\n\n{{external-link:def456|Mon lien|https://example.com}}";
    expect(parseExternalLinkIds(body)).toEqual(["abc123", "def456"]);
  });

  it("cleans enriched tokens to id-only", () => {
    const body = "Intro\n\n{{external-link:clxyz|Test lien|https://example.com}}\n\nOutro";
    expect(cleanExternalLinkTokens(body)).toBe(
      "Intro\n\n{{external-link:clxyz}}\n\nOutro"
    );
  });

  it("enriches canonical tokens with live metadata", () => {
    const body = "Text\n\n{{external-link:link1}}\n\n";
    const meta = {
      link1: {
        labelFr: "Teste",
        labelEn: "Test",
        url: "https://classmini580.blog",
        urlFr: null,
        urlEn: null,
      },
    };
    const enriched = enrichExternalLinkTokens(
      body,
      meta,
      "fr",
      resolveExternalLinkDisplayName
    );
    expect(enriched).toContain(
      externalLinkEnrichedPlaceholder(
        "link1",
        "Teste",
        "https://classmini580.blog"
      )
    );
  });

  it("refreshes stale sur-charge when metadata changes", () => {
    const stale = "{{external-link:link1|Old label|https://old.example}}";
    const meta = {
      link1: {
        labelFr: "Nouveau",
        labelEn: "New",
        url: "https://new.example",
        urlFr: null,
        urlEn: null,
      },
    };
    const enriched = enrichExternalLinkTokens(
      stale,
      meta,
      "fr",
      resolveExternalLinkDisplayName
    );
    expect(enriched).toBe(
      externalLinkEnrichedPlaceholder("link1", "Nouveau", "https://new.example")
    );
  });

  it("leaves unknown links unchanged", () => {
    const body = "{{external-link:missing}}";
    expect(
      enrichExternalLinkTokens(body, {}, "fr", resolveExternalLinkDisplayName)
    ).toBe(body);
  });

  it("parses unique ids in document order", () => {
    const a = "linkaaa111";
    const b = "linkbbb222";
    const body = [
      "Intro",
      externalLinkPlaceholder(a),
      "Middle",
      externalLinkPlaceholder(b),
      externalLinkPlaceholder(a),
    ].join("\n");

    expect(parseExternalLinkIds(body)).toEqual([a, b]);
  });

  it("resolves single url for both locales", () => {
    const link = { url: "https://example.com", urlFr: null, urlEn: null };
    expect(resolveExternalLinkUrl(link, "fr")).toBe("https://example.com");
    expect(resolveExternalLinkUrl(link, "en")).toBe("https://example.com");
  });

  it("resolves bilingual urls by locale", () => {
    const link = {
      url: null,
      urlFr: "https://example.fr",
      urlEn: "https://example.com",
    };
    expect(resolveExternalLinkUrl(link, "fr")).toBe("https://example.fr");
    expect(resolveExternalLinkUrl(link, "en")).toBe("https://example.com");
  });

  it("prefers single url over bilingual fields", () => {
    const link = {
      url: "https://both.example",
      urlFr: "https://example.fr",
      urlEn: "https://example.com",
    };
    expect(resolveExternalLinkUrl(link, "fr")).toBe("https://both.example");
  });
});
