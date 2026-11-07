import { describe, expect, it } from "vitest";
import { mediaGroupPlaceholder } from "@/lib/media-group-token";
import {
  collectMediaGroupIdsFromBodies,
  mediaDraftOnBlogClause,
  mediaLinkedToArticlesClause,
  mediaOrphanClause,
  mediaPublicOnBlogClause,
} from "@/lib/media-post-visibility";

describe("media-post-visibility helpers", () => {
  it("collects unique group ids from bodyFr/bodyEn in order", () => {
    const g1 = "aaa111";
    const g2 = "bbb222";
    const g3 = "ccc333";
    const ids = collectMediaGroupIdsFromBodies([
      {
        bodyFr: `Intro ${mediaGroupPlaceholder(g1)}\n${mediaGroupPlaceholder(g2)}`,
        bodyEn: `${mediaGroupPlaceholder(g2)}\n${mediaGroupPlaceholder(g3)}`,
      },
      { bodyFr: mediaGroupPlaceholder(g1), bodyEn: "" },
    ]);
    expect(ids).toEqual([g1, g2, g3]);
  });

  it("ignores empty bodies", () => {
    expect(collectMediaGroupIdsFromBodies([{ bodyFr: "", bodyEn: null }])).toEqual(
      []
    );
  });

  it("builds public clause with PostMedia PUBLISHED and optional groups", () => {
    expect(mediaPublicOnBlogClause([])).toEqual({
      OR: [{ posts: { some: { post: { status: "PUBLISHED" } } } }],
    });
    expect(mediaPublicOnBlogClause(["g1"])).toEqual({
      OR: [
        { posts: { some: { post: { status: "PUBLISHED" } } } },
        { groupMembers: { some: { groupId: { in: ["g1"] } } } },
      ],
    });
  });

  it("builds linked / orphan / draft clauses", () => {
    expect(mediaLinkedToArticlesClause(["g1"])).toEqual({
      OR: [
        { posts: { some: {} } },
        { groupMembers: { some: { groupId: { in: ["g1"] } } } },
      ],
    });
    expect(mediaOrphanClause(["g1"])).toEqual({
      AND: [
        { posts: { none: {} } },
        { groupMembers: { none: { groupId: { in: ["g1"] } } } },
      ],
    });
    expect(mediaOrphanClause([])).toEqual({
      AND: [{ posts: { none: {} } }],
    });
    const draft = mediaDraftOnBlogClause(["g1"], ["g1"]);
    expect(draft.AND).toHaveLength(2);
  });
});
