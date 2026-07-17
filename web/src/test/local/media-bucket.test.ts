import { describe, expect, it } from "vitest";
import {
  contentTypeFromFilename,
  isAllowedContentType,
  kindFromContentType,
  maxBytesForContentType,
  normalizeContentType,
} from "@/lib/media-bucket";
import { mediaWhere, parseMediaListParams } from "@/lib/media-library";

describe("media-bucket helpers", () => {
  it("detects kind from content-type", () => {
    expect(kindFromContentType("image/jpeg")).toBe("IMAGE");
    expect(kindFromContentType("image/png")).toBe("IMAGE");
    expect(kindFromContentType("application/pdf")).toBe("DOCUMENT");
    expect(kindFromContentType("video/mp4")).toBe("VIDEO");
    expect(kindFromContentType("video/webm")).toBe("VIDEO");
    expect(kindFromContentType("text/plain")).toBeNull();
  });

  it("allows only image / pdf / mp4 / webm", () => {
    expect(isAllowedContentType("image/webp")).toBe(true);
    expect(isAllowedContentType("application/pdf")).toBe(true);
    expect(isAllowedContentType("video/mp4")).toBe(true);
    expect(isAllowedContentType("application/zip")).toBe(false);
  });

  it("resolves content-type from filename and normalizes", () => {
    expect(contentTypeFromFilename("plan.PDF")).toBe("application/pdf");
    expect(contentTypeFromFilename("clip.webm")).toBe("video/webm");
    expect(normalizeContentType("Image/JPEG")).toBe("image/jpeg");
  });

  it("uses larger max bytes for video", () => {
    const imageMax = maxBytesForContentType("image/jpeg");
    const videoMax = maxBytesForContentType("video/mp4");
    expect(videoMax).toBeGreaterThan(imageMax);
  });
});

describe("media-library list params", () => {
  it("parses q/kind/limit/offset with defaults and clamps", () => {
    const sp = new URLSearchParams({
      q: "  coque ",
      kind: "DOCUMENT",
      limit: "500",
      offset: "-3",
    });
    expect(parseMediaListParams(sp)).toEqual({
      q: "coque",
      kind: "DOCUMENT",
      limit: 100,
      offset: 0,
    });
  });

  it("builds where for kind and text search", () => {
    expect(mediaWhere({ kind: "ALL" })).toEqual({});
    expect(mediaWhere({ kind: "VIDEO" })).toEqual({ kind: "VIDEO" });
    const withQ = mediaWhere({ q: "pdf" });
    expect(withQ.OR).toBeTruthy();
    expect(Array.isArray(withQ.OR)).toBe(true);
  });
});
