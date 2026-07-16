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
