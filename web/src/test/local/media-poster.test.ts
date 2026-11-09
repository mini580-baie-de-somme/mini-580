import { describe, expect, it } from "vitest";
import {
  mediaSupportsPoster,
  posterImageSrc,
  resolveKindThumbDisplay,
  resolveMediaThumbSrc,
  serializePosterSummary,
  validatePosterAssignment,
} from "@/lib/media-poster";

const poster = {
  id: "img-1",
  kind: "IMAGE",
  mimeType: "image/jpeg",
  urlOrigin: "/media/o.jpg",
  urlPicto: "/media/p.webp",
  urlPetite: "/media/pe.webp",
  urlMoyenne: "/media/m.webp",
  urlGrande: "/media/g.webp",
  titleFr: "Photo",
  titleEn: "Photo",
};

describe("mediaSupportsPoster", () => {
  it("allows VIDEO and DOCUMENT only", () => {
    expect(mediaSupportsPoster("VIDEO")).toBe(true);
    expect(mediaSupportsPoster("DOCUMENT")).toBe(true);
    expect(mediaSupportsPoster("IMAGE")).toBe(false);
    expect(mediaSupportsPoster(null)).toBe(false);
  });
});

describe("posterImageSrc / resolveMediaThumbSrc", () => {
  it("prefers picto then petite for poster", () => {
    expect(posterImageSrc(poster)).toBe("/media/p.webp");
    expect(
      posterImageSrc({ ...poster, urlPicto: null, urlPetite: null })
    ).toBe("/media/m.webp");
  });

  it("uses poster for VIDEO/DOCUMENT and own variants for IMAGE", () => {
    expect(
      resolveMediaThumbSrc({
        kind: "VIDEO",
        mimeType: "video/mp4",
        urlOrigin: "/media/v.mp4",
        poster,
      })
    ).toBe("/media/p.webp");

    expect(
      resolveMediaThumbSrc({
        kind: "DOCUMENT",
        mimeType: "application/pdf",
        urlOrigin: "/media/d.pdf",
        poster: null,
      })
    ).toBeNull();

    expect(
      resolveMediaThumbSrc({
        kind: "IMAGE",
        mimeType: "image/jpeg",
        urlOrigin: "/media/o.jpg",
        urlPicto: "/media/own.webp",
        poster,
      })
    ).toBe("/media/own.webp");
  });
});

describe("validatePosterAssignment", () => {
  it("clears with null on VIDEO/DOCUMENT", () => {
    expect(
      validatePosterAssignment({
        sourceId: "vid-1",
        sourceKind: "VIDEO",
        posterMediaId: null,
        poster: null,
      })
    ).toEqual({ ok: true, posterMediaId: null });
  });

  it("rejects IMAGE source", () => {
    const r = validatePosterAssignment({
      sourceId: "img-2",
      sourceKind: "IMAGE",
      posterMediaId: "img-1",
      poster: { id: "img-1", kind: "IMAGE" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });

  it("rejects self reference", () => {
    const r = validatePosterAssignment({
      sourceId: "vid-1",
      sourceKind: "VIDEO",
      posterMediaId: "vid-1",
      poster: { id: "vid-1", kind: "IMAGE" },
    });
    expect(r.ok).toBe(false);
  });

  it("rejects missing or non-IMAGE poster", () => {
    expect(
      validatePosterAssignment({
        sourceId: "vid-1",
        sourceKind: "VIDEO",
        posterMediaId: "x",
        poster: null,
      }).ok
    ).toBe(false);

    expect(
      validatePosterAssignment({
        sourceId: "vid-1",
        sourceKind: "VIDEO",
        posterMediaId: "doc-1",
        poster: { id: "doc-1", kind: "DOCUMENT" },
      }).ok
    ).toBe(false);
  });

  it("accepts IMAGE poster on VIDEO", () => {
    expect(
      validatePosterAssignment({
        sourceId: "vid-1",
        sourceKind: "VIDEO",
        posterMediaId: "img-1",
        poster: { id: "img-1", kind: "IMAGE" },
      })
    ).toEqual({ ok: true, posterMediaId: "img-1" });
  });
});

describe("resolveKindThumbDisplay", () => {
  it("shows poster image with VIDEO kind when src is image", () => {
    expect(
      resolveKindThumbDisplay({
        kind: "VIDEO",
        mimeType: "video/mp4",
        src: "/media/p.webp",
      })
    ).toEqual({ mode: "poster", kind: "VIDEO", src: "/media/p.webp" });
  });

  it("falls back to icon when VIDEO has no image src", () => {
    expect(
      resolveKindThumbDisplay({
        kind: "VIDEO",
        mimeType: "video/mp4",
        src: "/media/v.mp4",
      })
    ).toEqual({ mode: "icon", kind: "VIDEO" });
  });

  it("shows DOCUMENT poster when src is image", () => {
    expect(
      resolveKindThumbDisplay({
        kind: "DOCUMENT",
        mimeType: "application/pdf",
        src: "/media/p.webp",
      })
    ).toEqual({ mode: "poster", kind: "DOCUMENT", src: "/media/p.webp" });
  });
});

describe("serializePosterSummary", () => {
  it("returns null for empty and copies urls", () => {
    expect(serializePosterSummary(null)).toBeNull();
    expect(serializePosterSummary(poster)?.urlPicto).toBe("/media/p.webp");
  });
});
