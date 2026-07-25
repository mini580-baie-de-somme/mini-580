import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { resolve } from "node:path";
import { mkdirSync, rmSync, existsSync, unlinkSync } from "node:fs";
import sharp from "sharp";
import { assessMediaIntegrity } from "@/lib/media-integrity";
import {
  canRepairOriginFromLocalVariant,
  repairMediaOriginFromLocalVariant,
} from "@/lib/media-origin-repair";
import { storeOriginAndVariants } from "@/lib/media-variants";
import { mediaKeyFromUrl } from "@/lib/media-bucket";
import { prisma } from "@/lib/db";

describe("media-origin-repair", () => {
  const mediaRoot = resolve(process.cwd(), "data/media-it-origin-repair");

  beforeAll(() => {
    process.env.MEDIA_ROOT = mediaRoot;
    if (existsSync(mediaRoot)) rmSync(mediaRoot, { recursive: true, force: true });
    mkdirSync(mediaRoot, { recursive: true });
  });

  afterAll(() => {
    if (existsSync(mediaRoot)) rmSync(mediaRoot, { recursive: true, force: true });
  });

  it("offers repair when origin missing but grande variant exists", async () => {
    const jpeg = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 40, g: 50, b: 60 },
      },
    })
      .jpeg()
      .toBuffer();
    const urls = await storeOriginAndVariants(jpeg, "image/jpeg");
    const originKey = mediaKeyFromUrl(urls.urlOrigin)!;
    unlinkSync(resolve(mediaRoot, originKey));

    const input = { kind: "IMAGE" as const, ...urls };
    const before = await assessMediaIntegrity(input);
    expect(before.editable).toBe(false);
    expect(await canRepairOriginFromLocalVariant(input)).toBe(true);

    const media = await prisma.media.create({
      data: {
        kind: "IMAGE",
        mimeType: "image/jpeg",
        urlOrigin: urls.urlOrigin,
        urlPicto: urls.urlPicto,
        urlPetite: urls.urlPetite,
        urlMoyenne: urls.urlMoyenne,
        urlGrande: urls.urlGrande,
        titleFr: "repair-test",
        titleEn: "repair-test",
      },
    });

    const repaired = await repairMediaOriginFromLocalVariant(media.id);
    expect(repaired.integrity.editable).toBe(true);
    expect(repaired.urlOrigin).not.toBe(urls.urlOrigin);

    await prisma.media.delete({ where: { id: media.id } }).catch(() => null);
  });
});
