import "server-only";

import { randomUUID } from "node:crypto";
import sharp from "sharp";
import {
  contentTypeFromFilename,
  extensionForContentType,
  getMediaBucket,
  getMediaRoot,
  isAllowedContentType,
  maxBytesForContentType,
  mediaKeyFromUrl,
  normalizeContentType,
} from "@/lib/media-bucket";
import {
  MediaRebakeError,
  mediaTrace,
  siteUrlForMediaFetch,
  type MediaTraceContext,
} from "@/lib/media-trace";
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

/** Rebake output — urlOrigin present only when an external origin was localized. */
export type RebakedVariantUrls = Omit<MediaVariantUrls, "urlOrigin"> & {
  urlOrigin?: string;
};

type ResolvedOrigin = {
  body: Buffer;
  contentType: string;
  /** Set when origin bytes were fetched remotely and stored in the local bucket. */
  localizedUrl?: string;
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

function remoteOriginFetchUrl(originUrl: string): string | null {
  const trimmed = originUrl.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return null;
}

function originFetchCandidates(
  originUrl: string,
  localKey: string | null,
  localHit: boolean
): string[] {
  const candidates: string[] = [];
  const remote = remoteOriginFetchUrl(originUrl);
  if (remote) candidates.push(remote);

  if (!localHit && localKey) {
    const site = siteUrlForMediaFetch();
    if (site) {
      if (originUrl.startsWith("/")) {
        candidates.push(`${site}${originUrl}`);
      } else if (remote) {
        try {
          const parsed = new URL(originUrl);
          const siteOrigin = new URL(site);
          if (parsed.hostname === siteOrigin.hostname) {
            candidates.push(`${site}${parsed.pathname}${parsed.search}`);
          }
        } catch {
          // ignore malformed URL
        }
      }
    }
  }

  return [...new Set(candidates)];
}

function uniqueSourceUrls(
  primary: string,
  fallbacks: (string | null | undefined)[] = []
): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const raw of [primary, ...fallbacks]) {
    const url = raw?.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

export type ResolveOriginOptions = {
  /** Existing baked variants to try when the primary origin is missing or unreachable. */
  fallbackUrls?: (string | null | undefined)[];
};

type ResolveOriginAttempt = {
  sourceUrl: string;
  fetchError?: string;
};

async function resolveSingleSourceUrl(
  sourceUrl: string,
  trace: MediaTraceContext,
  opts: { localizeRemoteFetch: boolean }
): Promise<ResolvedOrigin | null> {
  const bucket = getMediaBucket();
  const localKey = mediaKeyFromUrl(sourceUrl);
  mediaTrace(trace, "resolveOrigin.source.start", {
    sourceUrl,
    localKey,
    mediaRoot: getMediaRoot(),
  });

  if (localKey) {
    const originObj = await bucket.getObject(localKey);
    mediaTrace(trace, "resolveOrigin.localLookup", {
      sourceUrl,
      localKey,
      hit: Boolean(originObj),
      bytes: originObj?.contentLength ?? 0,
    });
    if (originObj) {
      return { body: originObj.body, contentType: originObj.contentType };
    }
  }

  const fetchCandidates = originFetchCandidates(sourceUrl, localKey, false);
  mediaTrace(trace, "resolveOrigin.fetchCandidates", {
    sourceUrl,
    fetchCandidates,
  });
  if (fetchCandidates.length === 0) {
    return null;
  }

  let lastFetchError: string | undefined;
  for (const fetchUrl of fetchCandidates) {
    mediaTrace(trace, "resolveOrigin.fetch.start", { sourceUrl, fetchUrl });
    try {
      const res = await fetch(fetchUrl, {
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mini580MediaRebake/1.0 (+https://classmini580.blog)",
          Accept: "image/*,*/*;q=0.8",
        },
      });
      mediaTrace(trace, "resolveOrigin.fetch.response", {
        sourceUrl,
        fetchUrl,
        status: res.status,
        contentType: res.headers.get("content-type"),
      });
      if (!res.ok) {
        lastFetchError = `Origin fetch failed (${res.status}) for ${fetchUrl}`;
        continue;
      }

      const body = Buffer.from(await res.arrayBuffer());
      const rawCt =
        res.headers.get("content-type") ||
        contentTypeFromFilename(new URL(fetchUrl).pathname) ||
        "image/jpeg";
      const contentType = normalizeContentType(rawCt);
      if (!isAllowedContentType(contentType)) {
        lastFetchError = `Unsupported origin Content-Type (${contentType})`;
        continue;
      }
      const max = maxBytesForContentType(contentType);
      if (body.byteLength > max) {
        throw new MediaRebakeError(
          `Origin exceeds ${max} bytes`,
          "resolveOrigin",
          trace.traceId
        );
      }

      if (opts.localizeRemoteFetch && remoteOriginFetchUrl(sourceUrl)) {
        const ext = extensionForContentType(contentType) ?? "jpg";
        const { yyyy, mm } = yyyyMm();
        const id = randomUUID();
        const originKey = `${yyyy}/${mm}/${id}/origin.${ext}`;
        const stored = await bucket.putObject(originKey, body, contentType);
        mediaTrace(trace, "resolveOrigin.localized", {
          sourceUrl,
          fetchUrl,
          localizedUrl: stored.url,
          bytes: body.byteLength,
          contentType,
        });
        return { body, contentType, localizedUrl: stored.url };
      }

      mediaTrace(trace, "resolveOrigin.fetched", {
        sourceUrl,
        fetchUrl,
        bytes: body.byteLength,
        contentType,
      });
      return { body, contentType };
    } catch (err) {
      if (err instanceof MediaRebakeError) throw err;
      lastFetchError =
        err instanceof Error ? err.message : "Origin fetch failed";
      mediaTrace(trace, "resolveOrigin.fetch.error", {
        sourceUrl,
        fetchUrl,
        error: lastFetchError,
      });
    }
  }

  if (lastFetchError) {
    throw new MediaRebakeError(lastFetchError, "resolveOrigin", trace.traceId);
  }
  return null;
}

function originResolveFailureMessage(
  primaryUrl: string,
  attempts: ResolveOriginAttempt[]
): string {
  const tried = attempts.map((a) => a.sourceUrl);
  const lastHttp = [...attempts]
    .reverse()
    .find((a) => a.fetchError)?.fetchError;
  const preview = tried.slice(0, 4).join(", ");
  const suffix =
    tried.length > 4 ? ` (+${tried.length - 4} more)` : "";
  const base = lastHttp
    ? lastHttp
    : "Origin media not found locally and no fetchable URL";
  return `${base}. Tried: ${preview}${suffix}. Re-upload the original photo or replace the media file.`;
}

/** Read origin bytes from the local bucket, or fetch + localize remote http(s) URLs. */
export async function resolveOriginForBake(
  originUrl: string,
  trace: MediaTraceContext,
  options: ResolveOriginOptions = {}
): Promise<ResolvedOrigin> {
  const sourceUrls = uniqueSourceUrls(originUrl, options.fallbackUrls);
  mediaTrace(trace, "resolveOrigin.start", {
    originUrl,
    sourceUrls,
    fallbackCount: Math.max(0, sourceUrls.length - 1),
  });

  const attempts: ResolveOriginAttempt[] = [];
  let lastFetchError: string | undefined;

  for (const sourceUrl of sourceUrls) {
    try {
      const resolved = await resolveSingleSourceUrl(sourceUrl, trace, {
        localizeRemoteFetch: sourceUrl === originUrl,
      });
      if (resolved) {
        if (sourceUrl !== originUrl) {
          mediaTrace(trace, "resolveOrigin.fallbackUsed", {
            originUrl,
            sourceUrl,
            localizedUrl: resolved.localizedUrl,
          });
        }
        return resolved;
      }
      attempts.push({ sourceUrl });
    } catch (err) {
      if (err instanceof MediaRebakeError) {
        attempts.push({ sourceUrl, fetchError: err.message });
        lastFetchError = err.message;
        continue;
      }
      throw err;
    }
  }

  throw new MediaRebakeError(
    originResolveFailureMessage(originUrl, attempts) ||
      lastFetchError ||
      "Origin media not found",
    "resolveOrigin",
    trace.traceId
  );
}

/**
 * Re-read origin, bake layout into master, regenerate 4 fixed-size WebP variants.
 * Local origin files are kept unchanged; remote origins are copied into the bucket once.
 */
export async function bakeVariantsFromOrigin(
  originUrl: string,
  transform: ImageTransformParams,
  previousVariantUrls: (string | null | undefined)[] = [],
  trace: MediaTraceContext,
  options: ResolveOriginOptions = {}
): Promise<RebakedVariantUrls> {
  const bucket = getMediaBucket();
  mediaTrace(trace, "bakeVariants.start", {
    originUrl,
    layout: {
      offsetX: transform.offsetX,
      offsetY: transform.offsetY,
      scaleX: transform.scaleX,
      scaleY: transform.scaleY,
      rotation: transform.rotation,
      cropInset: transform.cropInset,
    },
  });

  let resolved: ResolvedOrigin;
  try {
    resolved = await resolveOriginForBake(originUrl, trace, options);
  } catch (err) {
    if (err instanceof MediaRebakeError) throw err;
    throw new MediaRebakeError(
      rebakeErrorMessage(err),
      "resolveOrigin",
      trace.traceId,
      err
    );
  }

  let master: Buffer;
  try {
    master = await applyImageTransform(resolved.body, transform);
    mediaTrace(trace, "bakeVariants.transformed", {
      masterBytes: master.byteLength,
    });
  } catch (err) {
    throw new MediaRebakeError(
      `Image transform failed: ${rebakeErrorMessage(err)}`,
      "applyImageTransform",
      trace.traceId,
      err
    );
  }

  const { yyyy, mm } = yyyyMm();
  const id = randomUUID();
  const base = `${yyyy}/${mm}/${id}`;

  try {
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

    await deleteMediaUrls(previousVariantUrls);

    const result = {
      ...(resolved.localizedUrl ? { urlOrigin: resolved.localizedUrl } : {}),
      urlPicto: picto.url,
      urlPetite: petite.url,
      urlMoyenne: moyenne.url,
      urlGrande: grande.url,
    };
    mediaTrace(trace, "bakeVariants.done", result);
    return result;
  } catch (err) {
    throw new MediaRebakeError(
      `Variant encode/store failed: ${rebakeErrorMessage(err)}`,
      "encodeVariants",
      trace.traceId,
      err
    );
  }
}

function rebakeErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
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
