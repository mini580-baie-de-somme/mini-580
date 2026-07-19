import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { resolve } from "node:path";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import {
  assessMediaIntegrity,
  assertEditableImageOrigin,
  isLocalMediaUrl,
} from "@/lib/media-integrity";
import { storeOriginAndVariants } from "@/lib/media-variants";
import { mediaKeyFromUrl } from "@/lib/media-bucket";

describe("media-integrity", () => {
  const mediaRoot = resolve(process.cwd(), "data/media-it-integrity");

  beforeAll(() => {
    process.env.MEDIA_ROOT = mediaRoot;
    if (existsSync(mediaRoot)) rmSync(mediaRoot, { recursive: true, force: true });
    mkdirSync(mediaRoot, { recursive: true });
  });

  afterAll(() => {
    if (existsSync(mediaRoot)) rmSync(mediaRoot, { recursive: true, force: true });
  });

  it("isLocalMediaUrl accepts /media paths only", () => {
    expect(isLocalMediaUrl("/media/2026/07/foo.jpg")).toBe(true);
    expect(isLocalMediaUrl("https://example.com/media/x.jpg")).toBe(false);
  });

  it("flags remote origin as non-editable", async () => {
    const status = await assessMediaIntegrity({
      kind: "IMAGE",
      urlOrigin: "https://blogger.googleusercontent.com/photo.jpg",
      urlPicto: null,
      urlPetite: null,
      urlMoyenne: null,
      urlGrande: null,
    });
    expect(status.ok).toBe(false);
    expect(status.editable).toBe(false);
    expect(status.issues).toContain("REMOTE_ORIGIN");
  });

  it("flags missing local origin file", async () => {
    const status = await assessMediaIntegrity({
      kind: "IMAGE",
      urlOrigin: "/media/2026/07/ghost-origin.jpg",
      urlPicto: "/media/2026/07/ghost-picto.webp",
      urlPetite: "/media/2026/07/ghost-petite.webp",
      urlMoyenne: "/media/2026/07/ghost-moyenne.webp",
      urlGrande: "/media/2026/07/ghost-grande.webp",
    });
    expect(status.ok).toBe(false);
    expect(status.editable).toBe(false);
    expect(status.issues).toContain("ORIGIN_MISSING");
  });

  it("passes for fully stored IMAGE media", async () => {
    const jpeg = await sharp({
      create: {
        width: 400,
        height: 300,
        channels: 3,
        background: { r: 10, g: 20, b: 30 },
      },
    })
      .jpeg()
      .toBuffer();
    const urls = await storeOriginAndVariants(jpeg, "image/jpeg");
    const status = await assessMediaIntegrity({
      kind: "IMAGE",
      ...urls,
    });
    expect(status.ok).toBe(true);
    expect(status.editable).toBe(true);
    expect(status.issues).toHaveLength(0);
    await assertEditableImageOrigin({ kind: "IMAGE", ...urls });
  });

  it("passes for local DOCUMENT with origin on disk", async () => {
    const key = "2026/07/doc-test.pdf";
    const full = resolve(mediaRoot, key);
    mkdirSync(resolve(full, ".."), { recursive: true });
    writeFileSync(full, "%PDF-1.4 test");
    const status = await assessMediaIntegrity({
      kind: "DOCUMENT",
      urlOrigin: `/media/${key}`,
    });
    expect(status.ok).toBe(true);
    expect(status.editable).toBe(true);
  });
});
