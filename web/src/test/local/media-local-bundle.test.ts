import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { resolve } from "node:path";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import sharp from "sharp";
import {
  imageBundleComplete,
  resolveLocalMediaBundleFromUrl,
} from "@/lib/media-local-bundle";
import {
  createMediaFromUrls,
  findOrCreateMediaFromLocalBundle,
} from "@/lib/media-library";
import { assessMediaIntegrity } from "@/lib/media-integrity";
import { storeOriginAndVariants } from "@/lib/media-variants";
import { prisma } from "@/lib/db";

describe("media-local-bundle", () => {
  const mediaRoot = resolve(process.cwd(), "data/media-it-local-bundle");

  beforeAll(() => {
    process.env.MEDIA_ROOT = mediaRoot;
    if (existsSync(mediaRoot)) rmSync(mediaRoot, { recursive: true, force: true });
    mkdirSync(mediaRoot, { recursive: true });
  });

  afterAll(() => {
    if (existsSync(mediaRoot)) rmSync(mediaRoot, { recursive: true, force: true });
  });

  it("resolves full bundle from origin URL", async () => {
    const jpeg = await sharp({
      create: {
        width: 320,
        height: 240,
        channels: 3,
        background: { r: 40, g: 50, b: 60 },
      },
    })
      .jpeg()
      .toBuffer();
    const stored = await storeOriginAndVariants(jpeg, "image/jpeg");
    expect(imageBundleComplete(stored)).toBe(true);

    const fromOrigin = await resolveLocalMediaBundleFromUrl(stored.urlOrigin);
    expect(fromOrigin).toEqual(stored);

    const fromVariant = await resolveLocalMediaBundleFromUrl(stored.urlMoyenne);
    expect(fromVariant).toEqual(stored);
  });

  it("createMediaFromUrls fills missing variants from local bundle", async () => {
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
    const stored = await storeOriginAndVariants(jpeg, "image/jpeg");

    const media = await createMediaFromUrls({
      urlOrigin: stored.urlOrigin,
      titleFr: "Telegram origin-only",
    });

    expect(media.urlPicto).toBe(stored.urlPicto);
    expect(media.urlPetite).toBe(stored.urlPetite);
    expect(media.urlMoyenne).toBe(stored.urlMoyenne);
    expect(media.urlGrande).toBe(stored.urlGrande);

    const integrity = await assessMediaIntegrity(media);
    expect(integrity.ok).toBe(true);
    expect(integrity.editable).toBe(true);

    await prisma.media.delete({ where: { id: media.id } }).catch(() => null);
  });

  it("findOrCreateMediaFromLocalBundle reuses existing row", async () => {
    const jpeg = await sharp({
      create: {
        width: 180,
        height: 120,
        channels: 3,
        background: { r: 5, g: 6, b: 7 },
      },
    })
      .jpeg()
      .toBuffer();
    const stored = await storeOriginAndVariants(jpeg, "image/jpeg");

    const first = await findOrCreateMediaFromLocalBundle(stored, {
      titleFr: "Once",
    });
    const second = await findOrCreateMediaFromLocalBundle(stored, {
      titleFr: "Twice",
    });

    expect(second.id).toBe(first.id);

    await prisma.media.delete({ where: { id: first.id } }).catch(() => null);
  });
});
