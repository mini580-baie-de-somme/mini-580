import { describe, expect, it } from "vitest";
import {
  isAllowedMediaFile,
  kindFromFile,
  kindFromMime,
  resolveFileMime,
  resolveThumbKind,
} from "@/lib/media-file-client";

describe("media-file-client", () => {
  it("detects image/pdf/video kinds from mime", () => {
    expect(kindFromMime("image/jpeg")).toBe("IMAGE");
    expect(kindFromMime("image/png")).toBe("IMAGE");
    expect(kindFromMime("image/webp")).toBe("IMAGE");
    expect(kindFromMime("application/pdf")).toBe("DOCUMENT");
    expect(kindFromMime("video/mp4")).toBe("VIDEO");
    expect(kindFromMime("video/webm")).toBe("VIDEO");
    expect(kindFromMime("text/plain")).toBeNull();
  });

  it("resolves mime from filename when File.type is empty", () => {
    const file = new File([new Uint8Array([1])], "plan.PDF", { type: "" });
    expect(resolveFileMime(file)).toBe("application/pdf");
    expect(kindFromFile(file)).toBe("DOCUMENT");
    expect(isAllowedMediaFile(file)).toBe(true);
  });
});

describe("resolveThumbKind — never treat PDF as image", () => {
  it("uses mimeType over wrong kind", () => {
    expect(
      resolveThumbKind("IMAGE", "application/pdf", "/media/x.jpg")
    ).toBe("DOCUMENT");
  });

  it("falls back to URL extension", () => {
    expect(resolveThumbKind(undefined, undefined, "/media/a/b/doc.pdf")).toBe(
      "DOCUMENT"
    );
    expect(resolveThumbKind(undefined, undefined, "/media/a/b/clip.mp4")).toBe(
      "VIDEO"
    );
  });

  it("keeps IMAGE when mime and kind agree", () => {
    expect(resolveThumbKind("IMAGE", "image/jpeg", "/media/a.webp")).toBe(
      "IMAGE"
    );
  });
});
