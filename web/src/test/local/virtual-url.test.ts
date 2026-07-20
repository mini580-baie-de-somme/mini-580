import { describe, expect, it, vi } from "vitest";
import {
  buildVirtualUrl,
  closeVirtualUrl,
  parseGalleryViewState,
  parseMediaEditState,
  parsePhotoModalState,
  serializeGalleryViewState,
  serializeMediaEditState,
  serializePhotoModalState,
  VIRTUAL_PARAM_COVER,
  VIRTUAL_PARAM_LIBRARY,
  VIRTUAL_PARAM_MEDIA,
  VIRTUAL_PARAM_PHOTO,
  VIRTUAL_PARAM_VIEW,
} from "@/lib/virtual-url";

describe("parsePhotoModalState / serializePhotoModalState", () => {
  it("parses closed when no photo modal params", () => {
    expect(parsePhotoModalState("")).toEqual({ kind: "closed" });
    expect(parsePhotoModalState("q=foo")).toEqual({ kind: "closed" });
  });

  it("round-trips add / edit / cover / library states", () => {
    const cases = [
      { kind: "add" as const },
      { kind: "edit" as const, imageId: "img-1" },
      { kind: "add-cover" as const },
      { kind: "edit-cover" as const, imageId: "img-2" },
      { kind: "pick-library" as const },
      { kind: "closed" as const },
    ];

    for (const state of cases) {
      const patch = serializePhotoModalState(state);
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(patch)) {
        if (v != null) qs.set(k, v);
      }
      expect(parsePhotoModalState(qs)).toEqual(state);
    }
  });

  it("prefers library picker over photo params", () => {
    expect(
      parsePhotoModalState(`${VIRTUAL_PARAM_LIBRARY}=1&${VIRTUAL_PARAM_PHOTO}=x`)
    ).toEqual({ kind: "pick-library" });
  });

  it("parses cover=1 with photo id as edit-cover", () => {
    expect(
      parsePhotoModalState(`${VIRTUAL_PARAM_COVER}=1&${VIRTUAL_PARAM_PHOTO}=abc`)
    ).toEqual({ kind: "edit-cover", imageId: "abc" });
  });

  it("parses cover=1 without photo as add-cover", () => {
    expect(parsePhotoModalState(`${VIRTUAL_PARAM_COVER}=1`)).toEqual({
      kind: "add-cover",
    });
  });
});

describe("parseMediaEditState / serializeMediaEditState", () => {
  it("returns null when media param absent", () => {
    expect(parseMediaEditState("")).toBeNull();
  });

  it("round-trips new and id", () => {
    expect(parseMediaEditState(`${VIRTUAL_PARAM_MEDIA}=new`)).toBe("new");
    expect(parseMediaEditState(`${VIRTUAL_PARAM_MEDIA}=m-42`)).toBe("m-42");
    expect(serializeMediaEditState("new")).toEqual({ media: "new" });
    expect(serializeMediaEditState(null)).toEqual({ media: null });
  });
});

describe("parseGalleryViewState / serializeGalleryViewState", () => {
  it("round-trips view photo id", () => {
    expect(parseGalleryViewState(`${VIRTUAL_PARAM_VIEW}=p-9`)).toBe("p-9");
    expect(serializeGalleryViewState("p-9")).toEqual({ view: "p-9" });
    expect(serializeGalleryViewState(null)).toEqual({ view: null });
  });
});

describe("buildVirtualUrl", () => {
  it("merges patch into existing params", () => {
    expect(
      buildVirtualUrl("/galerie", "search=boat", { view: "p1" })
    ).toBe("/galerie?search=boat&view=p1");
  });

  it("clears keys before applying patch", () => {
    expect(
      buildVirtualUrl(
        "/editeur/1",
        "photo=old&cover=1",
        { photo: "new" },
        [VIRTUAL_PARAM_COVER]
      )
    ).toBe("/editeur/1?photo=new");
  });

  it("removes keys when patch value is null", () => {
    expect(
      buildVirtualUrl("/galerie", "view=p1&sort=date", { view: null })
    ).toBe("/galerie?sort=date");
  });

  it("returns pathname only when query string is empty", () => {
    expect(buildVirtualUrl("/editeur/galerie", "media=x", { media: null })).toBe(
      "/editeur/galerie"
    );
  });

  it("preserves unrelated query params when opening photo modal", () => {
    const url = buildVirtualUrl(
      "/editeur/post-1",
      "search=hull&kind=photo",
      { photo: "img-7" }
    );
    expect(url).toBe("/editeur/post-1?search=hull&kind=photo&photo=img-7");
  });

  it("clears all photo modal keys when serializing closed state", () => {
    const patch = serializePhotoModalState({ kind: "closed" });
    expect(patch).toEqual({
      photo: null,
      cover: null,
      library: null,
    });
    const url = buildVirtualUrl(
      "/editeur/post-1",
      "photo=old&cover=1&library=1&search=x",
      patch
    );
    expect(url).toBe("/editeur/post-1?search=x");
  });
});

describe("closeVirtualUrl", () => {
  it("calls router.back when opened via push", () => {
    const router = { back: vi.fn(), replace: vi.fn() };
    closeVirtualUrl(router, "/galerie", "view=p1", ["view"], true);
    expect(router.back).toHaveBeenCalledOnce();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("replaces URL without virtual keys when not opened via push", () => {
    const router = { back: vi.fn(), replace: vi.fn() };
    closeVirtualUrl(
      router,
      "/galerie",
      "view=p1&search=boat",
      ["view"],
      false
    );
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith("/galerie?search=boat", {
      scroll: false,
    });
  });
});
