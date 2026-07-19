import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";
import sharp from "sharp";
import { resolve } from "node:path";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import {
  applyImageTransform,
  bakeVariantsFromOrigin,
  resolveOriginForBake,
  storeOriginAndVariants,
} from "@/lib/media-variants";
import {
  DEFAULT_IMAGE_LAYOUT,
  VARIANT_SIZE,
} from "@/lib/image-layout";
import { mediaKeyFromUrl } from "@/lib/media-bucket";
import { newMediaTraceId } from "@/lib/media-trace";
import { access } from "node:fs/promises";

const testTrace = { traceId: newMediaTraceId("test") };

async function makeLandscapeJpeg() {
  return sharp({
    create: {
      width: 800,
      height: 600,
      channels: 3,
      background: { r: 40, g: 140, b: 220 },
    },
  })
    .jpeg({ quality: 85 })
    .toBuffer();
}

async function webpSize(buf: Buffer) {
  const meta = await sharp(buf).metadata();
  return { w: meta.width ?? 0, h: meta.height ?? 0 };
}

describe("media-variants — fixed 3:4 layout bake", () => {
  const mediaRoot = resolve(process.cwd(), "data/media-it-layout");

  beforeAll(() => {
    process.env.MEDIA_ROOT = mediaRoot;
    if (existsSync(mediaRoot)) rmSync(mediaRoot, { recursive: true, force: true });
    mkdirSync(mediaRoot, { recursive: true });
  });

  afterAll(() => {
    if (existsSync(mediaRoot)) rmSync(mediaRoot, { recursive: true, force: true });
  });

  it("applyImageTransform always outputs exact grande dimensions", async () => {
    const jpeg = await makeLandscapeJpeg();
    const master = await applyImageTransform(jpeg, DEFAULT_IMAGE_LAYOUT);
    const size = await webpSize(master);
    expect(size).toEqual({
      w: VARIANT_SIZE.grande.w,
      h: VARIANT_SIZE.grande.h,
    });
  });

  it("supports free rotation, independent scale, circle crop and background", async () => {
    const jpeg = await makeLandscapeJpeg();
    const master = await applyImageTransform(jpeg, {
      offsetX: 0.1,
      offsetY: -0.05,
      scaleX: 1.3,
      scaleY: 0.9,
      rotation: 33,
      lockAspect: false,
      cropShape: "CIRCLE",
      backgroundColor: "#1e3a5f",
      cropInset: 0.08,
    });
    const size = await webpSize(master);
    expect(size.w).toBe(VARIANT_SIZE.grande.w);
    expect(size.h).toBe(VARIANT_SIZE.grande.h);
    // Non-empty baked buffer
    expect(master.byteLength).toBeGreaterThan(1000);
  });

  it("survives extreme pan/zoom that overflow the canvas (sharp composite clip)", async () => {
    const jpeg = await makeLandscapeJpeg();
    const master = await applyImageTransform(jpeg, {
      ...DEFAULT_IMAGE_LAYOUT,
      offsetX: 1.5,
      offsetY: -1.2,
      scaleX: 3.5,
      scaleY: 3.5,
      rotation: 90,
    });
    expect(await webpSize(master)).toEqual({
      w: VARIANT_SIZE.grande.w,
      h: VARIANT_SIZE.grande.h,
    });
  });

  it("bakes portrait sources and transparent backgrounds to grande WebP", async () => {
    const portrait = await sharp({
      create: {
        width: 400,
        height: 900,
        channels: 3,
        background: { r: 200, g: 80, b: 40 },
      },
    })
      .jpeg({ quality: 85 })
      .toBuffer();

    const master = await applyImageTransform(portrait, {
      ...DEFAULT_IMAGE_LAYOUT,
      backgroundColor: "transparent",
      cropInset: 0.2,
    });
    const meta = await sharp(master).metadata();
    expect(meta.width).toBe(VARIANT_SIZE.grande.w);
    expect(meta.height).toBe(VARIANT_SIZE.grande.h);
    expect(meta.format).toBe("webp");
  });

  it("storeOriginAndVariants keeps origin intact and writes 4 fixed-size WebPs", async () => {
    const jpeg = await makeLandscapeJpeg();
    const urls = await storeOriginAndVariants(jpeg, "image/jpeg", "boat.jpg");

    expect(urls.urlOrigin).toMatch(/origin\.jpe?g$/i);
    expect(urls.urlPicto).toMatch(/picto\.webp$/);
    expect(urls.urlPetite).toMatch(/petite\.webp$/);
    expect(urls.urlMoyenne).toMatch(/moyenne\.webp$/);
    expect(urls.urlGrande).toMatch(/grande\.webp$/);

    const root = process.env.MEDIA_ROOT!;
    for (const url of [
      urls.urlOrigin,
      urls.urlPicto,
      urls.urlPetite,
      urls.urlMoyenne,
      urls.urlGrande,
    ]) {
      const key = mediaKeyFromUrl(url)!;
      await access(resolve(root, key));
    }

    // Origin bytes stay JPEG (not rebaked as the master)
    const originKey = mediaKeyFromUrl(urls.urlOrigin)!;
    const { readFile } = await import("node:fs/promises");
    const originBuf = await readFile(resolve(root, originKey));
    const originMeta = await sharp(originBuf).metadata();
    expect(originMeta.format).toBe("jpeg");
    expect(originMeta.width).toBe(800);
    expect(originMeta.height).toBe(600);

    const grandeBuf = await readFile(
      resolve(root, mediaKeyFromUrl(urls.urlGrande)!)
    );
    const grandeMeta = await sharp(grandeBuf).metadata();
    expect(grandeMeta.width).toBe(VARIANT_SIZE.grande.w);
    expect(grandeMeta.height).toBe(VARIANT_SIZE.grande.h);
    expect(grandeMeta.format).toBe("webp");

    const pictoBuf = await readFile(
      resolve(root, mediaKeyFromUrl(urls.urlPicto)!)
    );
    const pictoMeta = await sharp(pictoBuf).metadata();
    expect(pictoMeta.width).toBe(VARIANT_SIZE.picto.w);
    expect(pictoMeta.height).toBe(VARIANT_SIZE.picto.h);
  });

  it("applyImageTransform handles cover-editor scale/rotation values", async () => {
    const jpeg = await makeLandscapeJpeg();
    const master = await applyImageTransform(jpeg, {
      offsetX: 0.52,
      offsetY: -0.01,
      scaleX: 3.3,
      scaleY: 3.3,
      rotation: -24,
      lockAspect: true,
      cropShape: "RECT",
      backgroundColor: "#000000",
      cropInset: 0.06,
    });
    expect(await webpSize(master)).toEqual({
      w: VARIANT_SIZE.grande.w,
      h: VARIANT_SIZE.grande.h,
    });
  });

  it("localizes remote http(s) origins before rebake", async () => {
    const jpeg = await makeLandscapeJpeg();
    const remoteUrl = "https://cdn.example.test/imported-cover.jpg";
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-type" ? "image/jpeg" : null,
      },
      arrayBuffer: async () =>
        jpeg.buffer.slice(jpeg.byteOffset, jpeg.byteOffset + jpeg.byteLength),
    }));
    vi.stubGlobal("fetch", fetchMock);

    try {
      const resolved = await resolveOriginForBake(remoteUrl, testTrace);
      expect(resolved.localizedUrl).toMatch(/\/media\/.*\/origin\.jpg$/);
      expect(resolved.body.byteLength).toBeGreaterThan(1000);

      const rebaked = await bakeVariantsFromOrigin(
        remoteUrl,
        {
          ...DEFAULT_IMAGE_LAYOUT,
          offsetX: 0.52,
          scaleX: 3.3,
          scaleY: 3.3,
          rotation: -24,
        },
        [],
        testTrace
      );
      expect(rebaked.urlOrigin).toMatch(/\/media\/.*\/origin\.jpg$/);
      expect(rebaked.urlMoyenne).toMatch(/moyenne\.webp$/);
      expect(fetchMock).toHaveBeenCalledWith(
        remoteUrl,
        expect.objectContaining({ redirect: "follow" })
      );

      const root = process.env.MEDIA_ROOT!;
      const { readFile } = await import("node:fs/promises");
      const moyenneMeta = await sharp(
        await readFile(resolve(root, mediaKeyFromUrl(rebaked.urlMoyenne)!))
      ).metadata();
      expect(moyenneMeta.width).toBe(VARIANT_SIZE.moyenne.w);
      expect(moyenneMeta.height).toBe(VARIANT_SIZE.moyenne.h);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("bakeVariantsFromOrigin regenerates variants without mutating origin", async () => {
    const jpeg = await makeLandscapeJpeg();
    const stored = await storeOriginAndVariants(jpeg, "image/jpeg");
    const root = process.env.MEDIA_ROOT!;
    const { readFile } = await import("node:fs/promises");
    const originBefore = await readFile(
      resolve(root, mediaKeyFromUrl(stored.urlOrigin)!)
    );

    const rebaked = await bakeVariantsFromOrigin(
      stored.urlOrigin,
      {
        ...DEFAULT_IMAGE_LAYOUT,
        rotation: 45,
        scaleX: 1.2,
        scaleY: 1.2,
        backgroundColor: "#000000",
      },
      [stored.urlPicto, stored.urlPetite, stored.urlMoyenne, stored.urlGrande],
      testTrace
    );

    expect(rebaked.urlMoyenne).not.toBe(stored.urlMoyenne);
    const originAfter = await readFile(
      resolve(root, mediaKeyFromUrl(stored.urlOrigin)!)
    );
    expect(originAfter.equals(originBefore)).toBe(true);

    const moyenneMeta = await sharp(
      await readFile(resolve(root, mediaKeyFromUrl(rebaked.urlMoyenne)!))
    ).metadata();
    expect(moyenneMeta.width).toBe(VARIANT_SIZE.moyenne.w);
    expect(moyenneMeta.height).toBe(VARIANT_SIZE.moyenne.h);
  });
});
