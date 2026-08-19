import { describe, expect, it } from "vitest";
import {
  externalLinkPlaceholder,
  parseExternalLinkIds,
  resolveExternalLinkUrl,
} from "@/lib/external-link-token";

describe("external-link-token", () => {
  it("builds canonical placeholder", () => {
    expect(externalLinkPlaceholder("cllink123")).toBe("{{external-link:cllink123}}");
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
