import { describe, expect, it } from "vitest";
import { postSearchOrConditions } from "@/lib/posts";

describe("postSearchOrConditions", () => {
  it("includes linked media title and description", () => {
    const or = postSearchOrConditions("chantier");
    const mediaClause = or.find(
      (c) => "mediaLinks" in c && c.mediaLinks !== undefined
    );
    expect(mediaClause).toBeDefined();
    expect(mediaClause?.mediaLinks).toMatchObject({
      some: {
        media: {
          OR: expect.arrayContaining([
            { titleFr: { contains: "chantier", mode: "insensitive" } },
            { descriptionEn: { contains: "chantier", mode: "insensitive" } },
          ]),
        },
      },
    });
  });

  it("includes FR/EN body and tag labels", () => {
    const or = postSearchOrConditions("foo");
    expect(or.some((c) => "bodyFr" in c)).toBe(true);
    expect(or.some((c) => "bodyEn" in c)).toBe(true);
    expect(or.some((c) => "tags" in c)).toBe(true);
  });
});
