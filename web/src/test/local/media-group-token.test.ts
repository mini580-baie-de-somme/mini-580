import { describe, expect, it } from "vitest";
import {
  cleanMediaGroupTokens,
  enrichMediaGroupTokens,
  mediaGroupEnrichedPlaceholder,
  mediaGroupPlaceholder,
  parseMediaGroupIds,
} from "@/lib/media-group-token";
import { resolveMediaGroupDisplayName } from "@/lib/media-group-display";

describe("media-group-token", () => {
  it("parses canonical and enriched tokens", () => {
    const body =
      "{{media-group:abc123}}\n\n{{media-group:def456|Mon groupe|3}}";
    expect(parseMediaGroupIds(body)).toEqual(["abc123", "def456"]);
  });

  it("cleans enriched tokens to id-only", () => {
    const body = "Intro\n\n{{media-group:clxyz|Test groupe|4}}\n\nOutro";
    expect(cleanMediaGroupTokens(body)).toBe(
      "Intro\n\n{{media-group:clxyz}}\n\nOutro"
    );
  });

  it("enriches canonical tokens with live metadata", () => {
    const body = "Text\n\n{{media-group:grp1}}\n\n";
    const meta = {
      grp1: {
        titleFr: "Montage couples",
        titleEn: "Couples montage",
        slug: "montage",
        memberCount: 4,
      },
    };
    const enriched = enrichMediaGroupTokens(
      body,
      meta,
      "fr",
      resolveMediaGroupDisplayName
    );
    expect(enriched).toContain(
      mediaGroupEnrichedPlaceholder("grp1", "Montage couples", 4)
    );
  });

  it("refreshes stale sur-charge when metadata changes", () => {
    const stale = "{{media-group:grp1|Old name|2}}";
    const meta = {
      grp1: {
        titleFr: "New name",
        titleEn: "New name",
        slug: "new",
        memberCount: 5,
      },
    };
    const enriched = enrichMediaGroupTokens(
      stale,
      meta,
      "fr",
      resolveMediaGroupDisplayName
    );
    expect(enriched).toBe(
      mediaGroupEnrichedPlaceholder("grp1", "New name", 5)
    );
  });

  it("leaves unknown groups unchanged", () => {
    const body = "{{media-group:missing}}";
    expect(
      enrichMediaGroupTokens(body, {}, "fr", resolveMediaGroupDisplayName)
    ).toBe(body);
  });

  it("mediaGroupPlaceholder is canonical", () => {
    expect(mediaGroupPlaceholder("abc")).toBe("{{media-group:abc}}");
  });
});
