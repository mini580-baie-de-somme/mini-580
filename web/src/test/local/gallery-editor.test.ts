import { describe, expect, it } from "vitest";
import {
  coverUrlFromImage,
  findCoverImage,
  toEditorImage,
  type GalleryEditorImage,
} from "@/lib/gallery-editor";

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
});
