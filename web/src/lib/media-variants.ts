import "server-only";

import { randomUUID } from "node:crypto";
import sharp from "sharp";
import {
  extensionForContentType,
  getMediaBucket,
  mediaKeyFromUrl,
  normalizeContentType,
} from "@/lib/media-bucket";

export const VARIANT_MAX_EDGE = {
  picto: 96,
  petite: 320,
  moyenne: 960,
  grande: 1920,
} as const;

export type MediaVariantUrls = {
  urlOrigin: string;
  urlPicto: string;
  urlPetite: string;
  urlMoyenne: string;
  urlGrande: string;
};

function yyyyMm(): { yyyy: string; mm: string } {
  const now = new Date();
  return {
    yyyy: String(now.getUTCFullYear()),
    mm: String(now.getUTCMonth() + 1).padStart(2, "0"),
  };
}

async function resizeWebp(buffer: Buffer, maxEdge: number): Promise<Buffer> {
  return sharp(buffer)
    .rotate() // honor EXIF
    .resize({
      width: maxEdge,
      height: maxEdge,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer();
}

export type ImageTransformParams = {
  focusX: number;
  focusY: number;
  zoom: number;
  rotation: number;
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
};

const IDENTITY_TRANSFORM: ImageTransformParams = {
  focusX: 0.5,
  focusY: 0.5,
  zoom: 1,
  rotation: 0,
  cropX: 0,
  cropY: 0,
  cropW: 1,
  cropH: 1,
};

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/**
 * Apply crop / zoom / focus / rotation to the origin buffer.
 * Result is the display master used to generate the 4 WebP sizes.
 */
export async function applyImageTransform(
  body: Buffer,
  transform: ImageTransformParams = IDENTITY_TRANSFORM
): Promise<Buffer> {
  const meta = await sharp(body).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width < 1 || height < 1) {
    throw new Error("Invalid image dimensions");
  }

  const cropX = clamp01(transform.cropX);
  const cropY = clamp01(transform.cropY);
  const cropW = Math.max(0.01, clamp01(transform.cropW));
  const cropH = Math.max(0.01, clamp01(transform.cropH));
  const zoom = Math.min(5, Math.max(0.1, transform.zoom || 1));
  const focusX = clamp01(transform.focusX);
  const focusY = clamp01(transform.focusY);
  const rotation = ((Math.round(transform.rotation / 90) * 90) % 360 + 360) % 360;

  // Crop window in pixels
  let left = Math.floor(cropX * width);
  let top = Math.floor(cropY * height);
  let extractW = Math.max(1, Math.floor(cropW * width));
  let extractH = Math.max(1, Math.floor(cropH * height));

  // Zoom: shrink extract around focus point inside the crop window
  if (zoom > 1) {
    const zoomedW = Math.max(1, Math.floor(extractW / zoom));
    const zoomedH = Math.max(1, Math.floor(extractH / zoom));
    const focusPxX = left + focusX * extractW;
    const focusPxY = top + focusY * extractH;
    left = Math.floor(focusPxX - zoomedW / 2);
    top = Math.floor(focusPxY - zoomedH / 2);
    extractW = zoomedW;
    extractH = zoomedH;
  }

  // Clamp extract to image bounds
  left = Math.min(Math.max(0, left), width - 1);
  top = Math.min(Math.max(0, top), height - 1);
  extractW = Math.min(extractW, width - left);
  extractH = Math.min(extractH, height - top);

  let pipeline = sharp(body).extract({
    left,
    top,
    width: Math.max(1, extractW),
    height: Math.max(1, extractH),
  });

  if (rotation !== 0) {
    pipeline = pipeline.rotate(rotation);
  }

  return pipeline.toBuffer();
}

/**
 * Re-read origin, bake transform into a display master, regenerate 4 WebP sizes.
 * Origin file is kept unchanged. Old variant URLs are deleted best-effort.
 */
export async function bakeVariantsFromOrigin(
  originUrl: string,
  transform: ImageTransformParams,
  previousVariantUrls: (string | null | undefined)[] = []
): Promise<Omit<MediaVariantUrls, "urlOrigin">> {
  const bucket = getMediaBucket();
  const originKey = mediaKeyFromUrl(originUrl);
  if (!originKey) {
    throw new Error("Invalid origin URL");
  }
  const originObj = await bucket.getObject(originKey);
  if (!originObj) {
    throw new Error("Origin media not found");
  }

  const baked = await applyImageTransform(originObj.body, transform);
  const { yyyy, mm } = yyyyMm();
  const id = randomUUID();
  const base = `${yyyy}/${mm}/${id}`;

  const [pictoBuf, petiteBuf, moyenneBuf, grandeBuf] = await Promise.all([
    resizeWebp(baked, VARIANT_MAX_EDGE.picto),
    resizeWebp(baked, VARIANT_MAX_EDGE.petite),
    resizeWebp(baked, VARIANT_MAX_EDGE.moyenne),
    resizeWebp(baked, VARIANT_MAX_EDGE.grande),
  ]);

  const [picto, petite, moyenne, grande] = await Promise.all([
    bucket.putObject(`${base}/picto.webp`, pictoBuf, "image/webp"),
    bucket.putObject(`${base}/petite.webp`, petiteBuf, "image/webp"),
    bucket.putObject(`${base}/moyenne.webp`, moyenneBuf, "image/webp"),
    bucket.putObject(`${base}/grande.webp`, grandeBuf, "image/webp"),
  ]);

  await deleteMediaUrls(previousVariantUrls);

  return {
    urlPicto: picto.url,
    urlPetite: petite.url,
    urlMoyenne: moyenne.url,
    urlGrande: grande.url,
  };
}

/**
 * Store original + picto/petite/moyenne/grande under `{yyyy}/{mm}/{uuid}/`.
 */
export async function storeOriginAndVariants(
  body: Buffer,
  contentType: string,
  filenameHint = "upload.jpg"
): Promise<MediaVariantUrls> {
  const bucket = getMediaBucket();
  const ct = normalizeContentType(contentType);
  const ext = extensionForContentType(ct) ?? "jpg";
  const { yyyy, mm } = yyyyMm();
  const id = randomUUID();
  const base = `${yyyy}/${mm}/${id}`;

  const originKey = `${base}/origin.${ext}`;
  const origin = await bucket.putObject(originKey, body, ct);

  const [pictoBuf, petiteBuf, moyenneBuf, grandeBuf] = await Promise.all([
    resizeWebp(body, VARIANT_MAX_EDGE.picto),
    resizeWebp(body, VARIANT_MAX_EDGE.petite),
    resizeWebp(body, VARIANT_MAX_EDGE.moyenne),
    resizeWebp(body, VARIANT_MAX_EDGE.grande),
  ]);

  const [picto, petite, moyenne, grande] = await Promise.all([
    bucket.putObject(`${base}/picto.webp`, pictoBuf, "image/webp"),
    bucket.putObject(`${base}/petite.webp`, petiteBuf, "image/webp"),
    bucket.putObject(`${base}/moyenne.webp`, moyenneBuf, "image/webp"),
    bucket.putObject(`${base}/grande.webp`, grandeBuf, "image/webp"),
  ]);

  void filenameHint;

  return {
    urlOrigin: origin.url,
    urlPicto: picto.url,
    urlPetite: petite.url,
    urlMoyenne: moyenne.url,
    urlGrande: grande.url,
  };
}

/** Best effort delete of origin + variants when a PostImage is removed. */
export async function deleteMediaUrls(urls: (string | null | undefined)[]) {
  const bucket = getMediaBucket();
  for (const url of urls) {
    if (!url) continue;
    const key = mediaKeyFromUrl(url);
    if (key) {
      try {
        await bucket.deleteObject(key);
      } catch {
        // ignore missing files
      }
    }
  }
}

export function displayImageUrl(image: {
  urlMoyenne?: string | null;
  urlGrande?: string | null;
  urlOrigin: string;
  urlPetite?: string | null;
  urlPicto?: string | null;
}): string {
  return (
    image.urlMoyenne ||
    image.urlGrande ||
    image.urlPetite ||
    image.urlOrigin
  );
}
