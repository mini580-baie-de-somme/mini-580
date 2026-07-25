import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { PostStatus } from "@/generated/prisma/client";
import { publicUrlForPost, postListSummaryFields } from "@/lib/posts";
import { getPublicSiteBaseUrl, publicBlogUrlForSlug, blogPathForSlug } from "@/lib/site-url";

describe("site-url + post publicUrl", () => {
  const prevSite = process.env.SITE_URL;

  beforeEach(() => {
    process.env.SITE_URL = "https://test.classmini580.blog";
  });

  afterEach(() => {
    if (prevSite === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = prevSite;
  });

  it("builds public blog URL from SITE_URL and slug", () => {
    expect(getPublicSiteBaseUrl()).toBe("https://test.classmini580.blog");
    expect(blogPathForSlug("mon-article")).toBe("/blog/mon-article");
    expect(publicBlogUrlForSlug("mon-article")).toBe(
      "https://test.classmini580.blog/blog/mon-article"
    );
  });

  it("publicUrl is null until published", () => {
    const slug = "draft-slug";
    expect(publicUrlForPost({ slug, status: PostStatus.DRAFT })).toBeNull();
    expect(publicUrlForPost({ slug, status: PostStatus.ARCHIVED })).toBeNull();
    expect(publicUrlForPost({ slug, status: PostStatus.PUBLISHED })).toBe(
      "https://test.classmini580.blog/blog/draft-slug"
    );
  });

  it("list summary includes blogPath always", () => {
    const fields = postListSummaryFields({
      slug: "x",
      status: PostStatus.DRAFT,
    });
    expect(fields.blogPath).toBe("/blog/x");
    expect(fields.publicUrl).toBeNull();
  });
});
