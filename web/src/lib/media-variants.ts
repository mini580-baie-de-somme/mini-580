import "server-only";

import { randomUUID } from "node:crypto";
import sharp from "sharp";
import {
  extensionForContentType,
  getMediaBucket,
  mediaKeyFromUrl,
  normalizeContentType,
} from "@/lib/media-bucket";
import {
  DEFAULT_IMAGE_LAYOUT,
  VARIANT_SIZE,
  layoutFromLegacy,
  type ImageLayoutParams,
} from "@/lib/image-layout";

/** @deprecated use VARIANT_SIZE — kept for callers expecting max-edge numbers */
export const VARIANT_MAX_EDGE = {
  picto: VARIANT_SIZE.picto.w,
  petite: VARIANT_SIZE.petite.w,
  moyenne: VARIANT_SIZE.moyenne.w,
  grande: VARIANT_SIZE.grande.w,
} as const;

export type MediaVariantUrls = {
  urlOrigin: string;
  urlPicto: string;
  urlPetite: string;
  urlMoyenne: string;
  urlGrande: string;
};

export type ImageTransformParams = ImageLayoutParams & {
  /** Legacy aliases — optional when callers still send focus/zoom/crop */
  focusX?: number;
  focusY?: number;
  zoom?: number;
  cropX?: number;
  cropY?: number;
  cropW?: number;
  cropH?: number;
};

function yyyyMm(): { yyyy: string; mm: string } {
  const now = new Date();
  return {
    yyyy: String(now.getUTCFullYear()),
    mm: String(now.getUTCMonth() + 1).padStart(2, "0"),
  };
}

function normalizeLayout(t: ImageTransformParams): ImageLayoutParams {
  return layoutFromLegacy(t);
}

function parseBg(color: string): { r: number; g: number; b: number; alpha: number } {
  if (!color || color === "transparent") {
    return { r: 0, g: 0, b: 0, alpha: 0 };
  }
  const hex = color.replace("#", "");
  if (hex.length === 6) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      alpha: 1,
    };
  }
  return { r: 0, g: 0, b: 0, alpha: 1 };
}

/**
 * Compose origin onto a fixed 3:4 canvas (grande), apply crop window + optional circle mask.
 * Origin file is never mutated — only the returned buffer is used for variants.
 */
export async function applyImageTransform(
  body: Buffer,
  transform: ImageTransformParams = DEFAULT_IMAGE_LAYOUT
): Promise<Buffer> {
  const layout = normalizeLayout(transform);
  const CW = VARIANT_SIZE.grande.w;
  const CH = VARIANT_SIZE.grande.h;
  const inset = Math.min(0.4, Math.max(0, layout.cropInset));
  const cropW = Math.max(1, Math.round(CW * (1 - 2 * inset)));
  const cropH = Math.max(1, Math.round(CH * (1 - 2 * inset)));
  const cropLeft = Math.round((CW - cropW) / 2);
  const cropTop = Math.round((CH - cropH) / 2);

  const bg = parseBg(layout.backgroundColor);

  // Honor EXIF, then optional free rotation (may change bounds)
  let photoBuf = await sharp(body).rotate().ensureAlpha().toBuffer();
  if (Math.abs(layout.rotation % 360) > 0.01) {
    photoBuf = await sharp(photoBuf)
      .rotate(layout.rotation, { background: bg })
      .ensureAlpha()
      .toBuffer();
  }

  const meta = await sharp(photoBuf).metadata();
  const iw = meta.width ?? 1;
  const ih = meta.height ?? 1;

  // Base “cover” size for the crop window, then apply user scale
  const coverScale = Math.max(cropW / iw, cropH / ih);
  const drawW = Math.max(1, Math.round(iw * coverScale * layout.scaleX));
  const drawH = Math.max(1, Math.round(ih * coverScale * layout.scaleY));

  const centerX = cropLeft + cropW / 2 + layout.offsetX * cropW;
  const centerY = cropTop + cropH / 2 + layout.offsetY * cropH;
  let dstLeft = Math.round(centerX - drawW / 2);
  let dstTop = Math.round(centerY - drawH / 2);

  const resizedPhoto = await sharp(photoBuf)
    .resize(drawW, drawH, { fit: "fill" })
    .ensureAlpha()
    .toBuffer();

  // Clip photo to canvas bounds (sharp rejects composites that overflow)
  let srcLeft = 0;
  let srcTop = 0;
  let srcW = drawW;
  let srcH = drawH;
  if (dstLeft < 0) {
    srcLeft = -dstLeft;
    srcW -= srcLeft;
    dstLeft = 0;
  }
  if (dstTop < 0) {
    srcTop = -dstTop;
    srcH -= srcTop;
    dstTop = 0;
  }
  if (dstLeft + srcW > CW) srcW = CW - dstLeft;
  if (dstTop + srcH > CH) srcH = CH - dstTop;

  let compositeInput: Buffer | null = null;
  if (srcW > 0 && srcH > 0) {
    compositeInput = await sharp(resizedPhoto)
      .extract({
        left: srcLeft,
        top: srcTop,
        width: Math.max(1, srcW),
        height: Math.max(1, srcH),
      })
      .toBuffer();
  }

  let composed = await sharp({
    create: {
      width: CW,
      height: CH,
      channels: 4,
      background: bg,
    },
  })
    .composite(
      compositeInput
        ? [{ input: compositeInput, left: dstLeft, top: dstTop }]
        : []
    )
    .png()
    .toBuffer();

  // Extract crop window
  let cropped = sharp(composed).extract({
    left: cropLeft,
    top: cropTop,
    width: cropW,
    height: cropH,
  });

  if (layout.cropShape === "CIRCLE") {
    const size = Math.min(cropW, cropH);
    const photoOnly = await cropped.ensureAlpha().toBuffer();
    const masked = await sharp(photoOnly)
      .composite([
        {
          input: Buffer.from(
            `<svg width="${cropW}" height="${cropH}"><circle cx="${cropW / 2}" cy="${
              cropH / 2
            }" r="${size / 2}" fill="white"/></svg>`
          ),
          blend: "dest-in",
        },
      ])
      .toBuffer();

    composed = await sharp({
      create: {
        width: cropW,
        height: cropH,
        channels: 4,
        background: bg,
      },
    })
      .composite([{ input: masked, left: 0, top: 0 }])
      .png()
      .toBuffer();
    cropped = sharp(composed);
  }

  // Upscale/downscale crop to exact grande box (master)
  return cropped
    .resize(CW, CH, { fit: "fill" })
    .webp({ quality: 88, alphaQuality: 90 })
    .toBuffer();
}

async function resizeExact(
  buffer: Buffer,
  w: number,
  h: number
): Promise<Buffer> {
  return sharp(buffer)
    .resize(w, h, { fit: "fill" })
    .webp({ quality: 82, alphaQuality: 90 })
    .toBuffer();
}

/**
 * Re-read origin, bake layout into master, regenerate 4 fixed-size WebP variants.
 * Origin file is kept unchanged.
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

  const master = await applyImageTransform(originObj.body, transform);
  const { yyyy, mm } = yyyyMm();
  const id = randomUUID();
  const base = `${yyyy}/${mm}/${id}`;

  const [pictoBuf, petiteBuf, moyenneBuf, grandeBuf] = await Promise.all([
    resizeExact(master, VARIANT_SIZE.picto.w, VARIANT_SIZE.picto.h),
    resizeExact(master, VARIANT_SIZE.petite.w, VARIANT_SIZE.petite.h),
    resizeExact(master, VARIANT_SIZE.moyenne.w, VARIANT_SIZE.moyenne.h),
    // master is already grande size webp — re-encode for consistency
    resizeExact(master, VARIANT_SIZE.grande.w, VARIANT_SIZE.grande.h),
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
 * Store original + 4 fixed 3:4 WebP variants (identity layout).
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

  const master = await applyImageTransform(body, DEFAULT_IMAGE_LAYOUT);

  const [pictoBuf, petiteBuf, moyenneBuf, grandeBuf] = await Promise.all([
    resizeExact(master, VARIANT_SIZE.picto.w, VARIANT_SIZE.picto.h),
    resizeExact(master, VARIANT_SIZE.petite.w, VARIANT_SIZE.petite.h),
    resizeExact(master, VARIANT_SIZE.moyenne.w, VARIANT_SIZE.moyenne.h),
    resizeExact(master, VARIANT_SIZE.grande.w, VARIANT_SIZE.grande.h),
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
