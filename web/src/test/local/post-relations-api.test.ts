import { describe, expect, it } from "vitest";
import { PostStatus } from "@/generated/prisma/client";
import { postRelationFields, serializePostEditorListItem } from "@/lib/posts";
import type { PostWithRelations } from "@/lib/posts";

function stubPost(overrides: Partial<PostWithRelations> = {}): PostWithRelations {
  const now = new Date("2026-07-25T12:00:00.000Z");
  return {
    id: "post-1",
    slug: "mon-article",
    titleFr: "Titre FR",
    titleEn: "Title EN",
    excerptFr: "",
    excerptEn: "",
    bodyFr: "",
    bodyEn: "",
    coverImageUrl: null,
    status: PostStatus.DRAFT,
    publishedAt: null,
    authorId: "author-1",
    createdAt: now,
    updatedAt: now,
    author: { id: "author-1", name: "A", email: "a@test.fr" },
    hulls: [{ postId: "post-1", hull: "HULL_268" }],
    tags: [
      {
        postId: "post-1",
        tagId: "tag-1",
        tag: {
          id: "tag-1",
          name: "coque",
          labelFr: "Coque",
          labelEn: "Hull",
          createdAt: now,
        },
      },
    ],
    themes: [
      {
        postId: "post-1",
        themeId: "theme-1",
        theme: {
          id: "theme-1",
          slug: "chantier",
          labelFr: "Chantier",
          labelEn: "Build",
        },
      },
    ],
    mediaLinks: [],
    workDays: null,
    ...overrides,
  } as PostWithRelations;
}

describe("postRelationFields + editor list serializer", () => {
  it("flattens tags and themes with ids for agent tools", () => {
    const rel = postRelationFields(stubPost());
    expect(rel.tagIds).toEqual(["tag-1"]);
    expect(rel.themeIds).toEqual(["theme-1"]);
    expect(rel.tags[0]).toMatchObject({
      id: "tag-1",
      name: "coque",
      labelFr: "Coque",
    });
    expect(rel.themes[0]).toMatchObject({
      id: "theme-1",
      slug: "chantier",
      labelFr: "Chantier",
    });
  });

  it("editor list item includes taxonomy and blogPath", () => {
    const item = serializePostEditorListItem(stubPost());
    expect(item.tags).toHaveLength(1);
    expect(item.themes).toHaveLength(1);
    expect(item.blogPath).toBe("/blog/mon-article");
    expect(item.publicUrl).toBeNull();
    expect(item.hulls).toHaveLength(1);
  });
});
