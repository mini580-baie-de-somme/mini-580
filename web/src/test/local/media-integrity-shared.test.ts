import { describe, expect, it } from "vitest";
import {
  collectExternalMediaUrls,
  isRemoteMediaUrl,
} from "@/lib/media-integrity-shared";

describe("media-integrity-shared", () => {
  it("detects remote URLs", () => {
    expect(isRemoteMediaUrl("https://blogger.googleusercontent.com/x.jpg")).toBe(
      true
    );
    expect(isRemoteMediaUrl("/media/2026/07/foo.jpg")).toBe(false);
  });

  it("collects unique external URLs with roles", () => {
    const urls = collectExternalMediaUrls({
      urlOrigin: "https://example.com/origin.jpg",
      urlPicto: "https://example.com/picto.webp",
      urlPetite: "https://example.com/picto.webp",
      urlMoyenne: "/media/2026/07/moyenne.webp",
      urlGrande: null,
    });
    expect(urls).toEqual([
      { role: "origin", url: "https://example.com/origin.jpg" },
      { role: "picto", url: "https://example.com/picto.webp" },
    ]);
  });
});
