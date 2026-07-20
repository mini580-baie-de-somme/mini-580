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
    expect(status.externalUrls).toEqual([
      {
        role: "origin",
        url: "https://blogger.googleusercontent.com/photo.jpg",
      },
    ]);
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

  it("flags non-/media origin path as ORIGIN_NOT_LOCAL", async () => {
    const status = await assessMediaIntegrity({
      kind: "IMAGE",
      urlOrigin: "/uploads/ghost.jpg",
      urlPicto: null,
      urlPetite: null,
      urlMoyenne: null,
      urlGrande: null,
    });
    expect(status.ok).toBe(false);
    expect(status.editable).toBe(false);
    expect(status.issues).toContain("ORIGIN_NOT_LOCAL");
  });

  it("flags missing variant files for IMAGE media", async () => {
    const jpeg = await sharp({
      create: {
        width: 200,
        height: 150,
        channels: 3,
        background: { r: 1, g: 2, b: 3 },
      },
    })
      .jpeg()
      .toBuffer();
    const urls = await storeOriginAndVariants(jpeg, "image/jpeg");
    const root = process.env.MEDIA_ROOT!;
    const pictoKey = mediaKeyFromUrl(urls.urlPicto!)!;
    rmSync(resolve(root, pictoKey));

    const status = await assessMediaIntegrity({
      kind: "IMAGE",
      ...urls,
    });
    expect(status.ok).toBe(false);
    expect(status.editable).toBe(true);
    expect(status.issues).toContain("VARIANT_MISSING");
  });

  it("assertEditableImageOrigin throws MediaIntegrityError when not editable", async () => {
    await expect(
      assertEditableImageOrigin({
        kind: "IMAGE",
        urlOrigin: "https://cdn.example.test/missing.jpg",
        urlPicto: null,
        urlPetite: null,
        urlMoyenne: null,
        urlGrande: null,
      })
    ).rejects.toMatchObject({ name: "MediaIntegrityError" });
  });
});
