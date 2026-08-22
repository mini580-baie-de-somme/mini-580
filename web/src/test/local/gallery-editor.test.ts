import { describe, expect, it } from "vitest";
import {
  coalesceEditorOrigin,
  coverUrlFromImage,
  editorCanvasSrc,
  findCoverImage,
  galleryThumbSrc,
  mediaLibraryOpenUrl,
  mediaVariantSnapshot,
  mergeEditorImageLayout,
  resolveCoverImage,
  toEditorImage,
  type GalleryEditorImage,
} from "@/lib/gallery-editor";
import { DEFAULT_IMAGE_LAYOUT } from "@/lib/image-layout";

function img(
  partial: Partial<GalleryEditorImage> & { id: string }
): GalleryEditorImage {
  return {
    urlOrigin: `/media/${partial.id}/origin.jpg`,
    urlPicto: null,
    urlPetite: null,
    urlMoyenne: null,
    urlGrande: null,
    titleFr: "",
    titleEn: "",
    descriptionFr: "",
    descriptionEn: "",
    takenAt: null,
    sortOrder: 0,
    offsetX: 0,
    offsetY: 0,
    scaleX: 1,
    scaleY: 1,
    lockAspect: true,
    cropShape: "RECT",
    backgroundColor: "#000000",
    cropInset: 0.06,
    focusX: 0.5,
    focusY: 0.5,
    zoom: 1,
    rotation: 0,
    cropX: 0,
    cropY: 0,
    cropW: 1,
    cropH: 1,
    ...partial,
  };
}

describe("gallery-editor cover helpers", () => {
  it("prefers moyenne → grande → petite → origin for display URL", () => {
    expect(
      coverUrlFromImage(
        img({
          id: "a",
          urlMoyenne: "/m.webp",
          urlGrande: "/g.webp",
          urlPetite: "/p.webp",
        })
      )
    ).toBe("/m.webp");
    expect(
      coverUrlFromImage(img({ id: "b", urlGrande: "/g.webp" }))
    ).toBe("/g.webp");
    expect(coverUrlFromImage(img({ id: "c" }))).toBe("/media/c/origin.jpg");
  });

  it("finds cover by any stored variant URL", () => {
    const images = [
      img({
        id: "1",
        urlMoyenne: "/media/1/moyenne.webp",
        urlGrande: "/media/1/grande.webp",
      }),
      img({ id: "2", urlOrigin: "/media/2/origin.jpg" }),
    ];
    expect(findCoverImage(images, "/media/1/grande.webp")?.id).toBe("1");
    expect(findCoverImage(images, "/media/2/origin.jpg")?.id).toBe("2");
    expect(findCoverImage(images, "/missing")).toBeNull();
    expect(findCoverImage(images, null)).toBeNull();
  });

  it("resolveCoverImage falls back to coverMediaId when URL is stale", () => {
    const images = [
      img({
        id: "1",
        urlMoyenne: "/media/1/moyenne-v2.webp",
        urlGrande: "/media/1/grande-v2.webp",
      }),
      img({ id: "2", urlOrigin: "/media/2/origin.jpg" }),
    ];
    expect(
      resolveCoverImage(images, "/media/1/grande-v1.webp", "1")?.id
    ).toBe("1");
    expect(
      resolveCoverImage(images, "/media/1/grande-v2.webp", "1")?.id
    ).toBe("1");
    expect(resolveCoverImage(images, "/stale", "missing")).toBeNull();
    expect(resolveCoverImage(images, null, "1")?.id).toBe("1");
  });

  it("resolveCoverImage prefers URL match over id fallback", () => {
    const images = [
      img({ id: "1", urlMoyenne: "/media/1/m.webp" }),
      img({ id: "2", urlMoyenne: "/media/2/m.webp" }),
    ];
    expect(resolveCoverImage(images, "/media/2/m.webp", "1")?.id).toBe("2");
  });

  it("preserves layout fields from API payload for round-trip editor reopen", () => {
    const mapped = toEditorImage({
      id: "img-1",
      urlOrigin: "/media/x/origin.jpg",
      offsetX: 0.22,
      offsetY: -0.15,
      scaleX: 1.85,
      scaleY: 1.85,
      lockAspect: true,
      rotation: 45,
      cropShape: "RECT",
      backgroundColor: "#374151",
      cropInset: 0.1,
      focusX: 0.5,
      zoom: 1,
    });
    expect(mapped.scaleX).toBeCloseTo(1.85, 5);
    expect(mapped.offsetX).toBeCloseTo(0.22, 5);
    expect(mapped.rotation).toBe(45);
    expect(mapped.cropInset).toBeCloseTo(0.1, 5);
  });

  it("maps raw API payload including kind/mime for non-images", () => {
    const mapped = toEditorImage({
      id: "pdf-1",
      kind: "DOCUMENT",
      mimeType: "application/pdf",
      urlOrigin: "/media/x/doc.pdf",
      titleFr: "Plan",
      captionFr: "legacy caption",
    });
    expect(mapped.kind).toBe("DOCUMENT");
    expect(mapped.mimeType).toBe("application/pdf");
    expect(mapped.descriptionFr).toBe("legacy caption");
  });

  it("galleryThumbSrc prefers picto/petite/moyenne and never origin", () => {
    expect(
      galleryThumbSrc(
        img({
          id: "t",
          urlPicto: "/p.webp",
          urlPetite: "/pt.webp",
          urlMoyenne: "/m.webp",
          urlOrigin: "/origin.jpg",
        })
      )
    ).toBe("/p.webp?v=0-1.0000-0.00-p.webp");
    expect(
      galleryThumbSrc(
        img({ id: "u", urlMoyenne: "/m.webp", urlOrigin: "/origin.jpg" })
      )
    ).toBe("/m.webp?v=0-1.0000-0.00-m.webp");
    expect(galleryThumbSrc(img({ id: "v", urlOrigin: "/origin.jpg" }))).toBeNull();
  });

  it("mediaVariantSnapshot captures all variant URLs for rebake poll", () => {
    expect(
      mediaVariantSnapshot(
        img({
          id: "w",
          urlPicto: "/p.webp",
          urlPetite: "/pt.webp",
          urlMoyenne: "/m.webp",
          urlGrande: "/g.webp",
        })
      )
    ).toEqual({
      urlPicto: "/p.webp",
      urlPetite: "/pt.webp",
      urlMoyenne: "/m.webp",
      urlGrande: "/g.webp",
    });
  });

  it("mediaLibraryOpenUrl prefers grande for images, origin for documents", () => {
    expect(
      mediaLibraryOpenUrl(
        img({
          id: "img",
          urlGrande: "/media/img/grande.webp",
          urlMoyenne: "/media/img/moyenne.webp",
          urlOrigin: "/media/img/origin.jpg",
        })
      )
    ).toBe("/media/img/grande.webp");
    expect(
      mediaLibraryOpenUrl(
        img({
          id: "pending",
          urlMoyenne: "/media/pending/moyenne.webp",
          urlOrigin: "/media/pending/origin.jpg",
        })
      )
    ).toBe("/media/pending/moyenne.webp");
    expect(
      mediaLibraryOpenUrl(
        img({ id: "doc", kind: "DOCUMENT", urlOrigin: "/media/doc/plan.pdf" })
      )
    ).toBe("/media/doc/plan.pdf");
  });

  it("editorCanvasSrc uses local preview or cache-busted origin only", () => {
    expect(editorCanvasSrc(img({ id: "a" }), "/blob/preview")).toBe(
      "/blob/preview"
    );
    expect(
      editorCanvasSrc(
        img({
          id: "b",
          urlOrigin: "/media/b/origin.jpg",
          updatedAt: "2026-08-13T00:00:00.000Z",
          urlMoyenne: "/media/b/moyenne.webp",
          urlGrande: "/media/b/grande.webp",
        })
      )
    ).toBe("/media/b/origin.jpg?v=2026-08-13T00%3A00%3A00.000Z");
    expect(
      editorCanvasSrc(
        img({
          id: "c",
          urlOrigin: "",
          urlMoyenne: "/media/c/moyenne.webp",
        })
      )
    ).toBeNull();
  });

  it("mergeEditorImageLayout preserves cropAspectFormat from opts", () => {
    const merged = mergeEditorImageLayout(
      img({ id: "fmt", cropAspectFormat: "LANDSCAPE_16_9" }),
      { ...DEFAULT_IMAGE_LAYOUT, offsetX: 0.2 },
      { cropAspectFormat: "PORTRAIT_3_4" }
    );
    expect(merged.cropAspectFormat).toBe("PORTRAIT_3_4");
    expect(merged.offsetX).toBeCloseTo(0.2, 5);
  });

  it("coalesceEditorOrigin keeps previous origin when API row is empty", () => {
    expect(
      coalesceEditorOrigin(
        img({ id: "x", urlOrigin: "" }),
        img({ id: "x", urlOrigin: "/media/x/origin.jpg" })
      )
    ).toBe("/media/x/origin.jpg");
    expect(
      coalesceEditorOrigin(img({ id: "y", urlOrigin: "/media/y/new.jpg" }))
    ).toBe("/media/y/new.jpg");
  });
});
