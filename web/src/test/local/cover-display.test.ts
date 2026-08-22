import { describe, expect, it } from "vitest";
import {
  COVER_DEFAULT_CROP_FORMAT,
  coverDisplayAspectRatio,
  coverDisplayIsCircle,
  coverUrlMatchesMedia,
  resolveCoverCropAspectFormat,
  shouldNormalizeCoverFormat,
} from "@/lib/cover-display";

const media = (
  id: string,
  urls: Partial<{
    urlOrigin: string;
    urlMoyenne: string;
    cropAspectFormat: string;
    cropShape: string;
  }> = {}
) => ({
  isCover: false,
  media: {
    urlOrigin: urls.urlOrigin ?? `/media/${id}/origin.jpg`,
    urlGrande: null,
    urlMoyenne: urls.urlMoyenne ?? `/media/${id}/moyenne.webp`,
    urlPetite: null,
    urlPicto: null,
    cropAspectFormat: urls.cropAspectFormat ?? "PORTRAIT_3_4",
    cropShape: urls.cropShape ?? "RECT",
  },
});

describe("cover display", () => {
  it("matches cover URLs against any baked variant", () => {
    const row = media("1", { urlMoyenne: "/media/1/m.webp" }).media;
    expect(coverUrlMatchesMedia("/media/1/m.webp", row)).toBe(true);
    expect(coverUrlMatchesMedia("/media/1/other.webp", row)).toBe(false);
  });

  it("prefers isCover link for crop format", () => {
    const links = [
      { ...media("1", { cropAspectFormat: "LANDSCAPE_16_9" }), isCover: false },
      { ...media("2", { cropAspectFormat: "SQUARE" }), isCover: true },
    ];
    expect(
      resolveCoverCropAspectFormat("/media/1/moyenne.webp", links)
    ).toBe("SQUARE");
  });

  it("falls back to URL match when no isCover flag", () => {
    const links = [
      media("1", {
        urlMoyenne: "/media/1/m.webp",
        cropAspectFormat: "SQUARE",
      }),
    ];
    expect(resolveCoverCropAspectFormat("/media/1/m.webp", links)).toBe(
      "SQUARE"
    );
  });

  it("defaults to portrait 3:4 for orphan cover URLs", () => {
    expect(resolveCoverCropAspectFormat("/orphan.jpg", [])).toBe("PORTRAIT_3_4");
  });

  it("exposes aspect ratio css values per format", () => {
    expect(coverDisplayAspectRatio("SQUARE")).toBe("1");
    expect(coverDisplayAspectRatio("LANDSCAPE_16_9")).toBe(String(16 / 9));
    expect(coverDisplayAspectRatio("PORTRAIT_3_4")).toBe(String(3 / 4));
  });

  it("detects circle display from format or crop shape", () => {
    expect(coverDisplayIsCircle("CIRCLE")).toBe(true);
    expect(coverDisplayIsCircle("SQUARE", "CIRCLE")).toBe(true);
    expect(coverDisplayIsCircle("SQUARE", "RECT")).toBe(false);
  });

  it("normalizes library covers to the default 16:9 format on first attach only", () => {
    expect(COVER_DEFAULT_CROP_FORMAT).toBe("LANDSCAPE_16_9");
    expect(shouldNormalizeCoverFormat("LANDSCAPE_4_3")).toBe(true);
    expect(shouldNormalizeCoverFormat("SQUARE")).toBe(true);
    expect(shouldNormalizeCoverFormat("LANDSCAPE_16_9")).toBe(false);
    expect(
      shouldNormalizeCoverFormat("PORTRAIT_3_4", { isFirstCoverAttach: false })
    ).toBe(false);
    expect(
      shouldNormalizeCoverFormat("SQUARE", { isFirstCoverAttach: true })
    ).toBe(true);
  });
});
