import { describe, expect, it } from "vitest";
import {
  extractMediaLinkInfo,
  hasBlockingMediaLinks,
  mediaLinkLabel,
} from "@/lib/media-links";

describe("media-links", () => {
  const post = (id: string, titleFr: string, isCover: boolean) => ({
    isCover,
    post: {
      id,
      titleFr,
      titleEn: titleFr,
      slug: id,
      status: "DRAFT" as const,
    },
  });

  const group = (id: string, titleFr: string) => ({
    group: { id, titleFr, titleEn: titleFr, slug: id },
  });

  it("extracts cover links and groups separately", () => {
    const info = extractMediaLinkInfo({
      posts: [
        post("p1", "Article couverture", true),
        post("p2", "Legacy standalone", false),
        post("p3", "Autre legacy", false),
      ],
      groupMembers: [group("g1", "Groupe A"), group("g2", "Groupe B")],
    });
    expect(info.coverLinks).toHaveLength(1);
    expect(info.coverLinks[0]?.titleFr).toBe("Article couverture");
    expect(info.groups).toHaveLength(2);
    expect(info.legacyPostLinkCount).toBe(2);
  });

  it("hasBlockingMediaLinks ignores legacy PostMedia", () => {
    expect(
      hasBlockingMediaLinks(
        extractMediaLinkInfo({
          posts: [post("p1", "Legacy only", false)],
          groupMembers: [],
        })
      )
    ).toBe(false);
    expect(
      hasBlockingMediaLinks(
        extractMediaLinkInfo({
          posts: [post("p1", "Cover", true)],
          groupMembers: [],
        })
      )
    ).toBe(true);
    expect(
      hasBlockingMediaLinks(
        extractMediaLinkInfo({
          posts: [],
          groupMembers: [group("g1", "Grp")],
        })
      )
    ).toBe(true);
  });

  it("mediaLinkLabel prefers locale title then slug", () => {
    expect(
      mediaLinkLabel({ titleFr: "Titre FR", titleEn: "Title EN", slug: "s" }, "fr")
    ).toBe("Titre FR");
    expect(
      mediaLinkLabel({ titleFr: "", titleEn: "Title EN", slug: "my-slug" }, "en")
    ).toBe("Title EN");
    expect(
      mediaLinkLabel({ titleFr: "", titleEn: "", slug: "my-slug" }, "fr")
    ).toBe("my-slug");
  });
});
