import { describe, expect, it } from "vitest";
import { blogListPath, blogListQueryString } from "@/lib/blog-list-url";

describe("blogListPath", () => {
  it("returns bare /blog with no filters", () => {
    expect(blogListPath()).toBe("/blog");
    expect(blogListQueryString({})).toBe("");
  });

  it("builds theme and tag query params", () => {
    expect(blogListPath({ theme: "chantier" })).toBe("/blog?theme=chantier");
    expect(blogListPath({ tag: "okoume" })).toBe("/blog?tag=okoume");
    expect(blogListQueryString({ hull: "268", search: " epoxy " })).toBe(
      "?search=epoxy&hull=268"
    );
  });
});
