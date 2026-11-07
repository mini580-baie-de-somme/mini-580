import { describe, expect, it } from "vitest";
import { resolveMediaLibraryVisibility } from "@/lib/media-library-visibility";

describe("resolveMediaLibraryVisibility", () => {
  it("prefers server-computed visibility", () => {
    expect(
      resolveMediaLibraryVisibility({
        visibility: "orphan",
        postStatuses: ["PUBLISHED"],
      })
    ).toBe("orphan");
  });

  it("marks public when any PostMedia post is PUBLISHED", () => {
    expect(
      resolveMediaLibraryVisibility({
        postStatuses: ["DRAFT", "PUBLISHED"],
      })
    ).toBe("public");
  });

  it("marks public when referenced by a published group body", () => {
    expect(
      resolveMediaLibraryVisibility({
        postStatuses: [],
        referencedByPublishedGroup: true,
      })
    ).toBe("public");
  });

  it("marks draft when linked via PostMedia but none published", () => {
    expect(
      resolveMediaLibraryVisibility({
        postStatuses: ["DRAFT"],
      })
    ).toBe("draft");
  });

  it("marks draft when only referenced by a non-published group body", () => {
    expect(
      resolveMediaLibraryVisibility({
        referencedByAnyGroup: true,
        referencedByPublishedGroup: false,
      })
    ).toBe("draft");
  });

  it("marks orphan when no PostMedia and no body-referenced group", () => {
    expect(resolveMediaLibraryVisibility({})).toBe("orphan");
    expect(
      resolveMediaLibraryVisibility({
        hasPostMediaLink: false,
        referencedByAnyGroup: false,
      })
    ).toBe("orphan");
  });
});
