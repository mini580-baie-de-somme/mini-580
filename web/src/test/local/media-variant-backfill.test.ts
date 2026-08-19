import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { resolve } from "node:path";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { assessMediaIntegrity } from "@/lib/media-integrity";
import { storeOriginAndVariants } from "@/lib/media-variants";
import { backfillIncompleteMediaVariants } from "@/lib/media-variant-backfill";

describe("media-variant-backfill", () => {
  const mediaRoot = resolve(process.cwd(), "data/media-it-variant-backfill");

  beforeAll(() => {
    process.env.MEDIA_ROOT = mediaRoot;
    if (existsSync(mediaRoot)) rmSync(mediaRoot, { recursive: true, force: true });
    mkdirSync(mediaRoot, { recursive: true });
  });

  afterAll(() => {
    if (existsSync(mediaRoot)) rmSync(mediaRoot, { recursive: true, force: true });
  });

  it("repairs Telegram-style origin-only rows when variants exist on disk", async () => {
    const jpeg = await sharp({
      create: {
        width: 240,
        height: 180,
        channels: 3,
        background: { r: 10, g: 20, b: 30 },
      },
    })
      .jpeg()
      .toBuffer();
    const stored = await storeOriginAndVariants(jpeg, "image/jpeg");

    const broken = await prisma.media.create({
      data: {
        kind: "IMAGE",
        mimeType: "image/jpeg",
        urlOrigin: stored.urlOrigin,
        urlPicto: null,
        urlPetite: null,
        urlMoyenne: stored.urlOrigin,
        urlGrande: null,
        titleFr: "Broken telegram row",
      },
    });

    const before = await assessMediaIntegrity(broken);
    expect(before.ok).toBe(false);
    expect(before.issues).toContain("VARIANT_MISSING");

    const result = await backfillIncompleteMediaVariants();
    expect(result.updated).toBeGreaterThanOrEqual(1);

    const fixed = await prisma.media.findUniqueOrThrow({ where: { id: broken.id } });
    const after = await assessMediaIntegrity(fixed);
    expect(after.ok).toBe(true);
    expect(after.editable).toBe(true);
    expect(fixed.urlPicto).toBe(stored.urlPicto);
    expect(fixed.urlGrande).toBe(stored.urlGrande);

    await prisma.media.delete({ where: { id: broken.id } }).catch(() => null);
  });
});
