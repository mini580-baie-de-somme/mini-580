import "server-only";

import { getMediaBucket, mediaKeyFromUrl } from "@/lib/media-bucket";
import { isLocalMediaUrl } from "@/lib/media-integrity";
import type { MediaVariantUrls } from "@/lib/media-variants";

const ORIGIN_FILENAME_RE = /^origin\.(jpe?g|png|webp|gif)$/i;
const VARIANT_FILENAME_RE = /^(picto|petite|moyenne|grande)\.webp$/i;
const ORIGIN_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif"] as const;

const VARIANT_FILES = {
  urlPicto: "picto.webp",
  urlPetite: "petite.webp",
  urlMoyenne: "moyenne.webp",
  urlGrande: "grande.webp",
} as const satisfies Record<
  Exclude<keyof MediaVariantUrls, "urlOrigin">,
  string
>;

function mediaBaseKeyFromObjectKey(key: string): string | null {
  const slash = key.lastIndexOf("/");
  if (slash < 0) return null;
  return key.slice(0, slash);
}

async function resolveOriginKey(
  key: string,
  filename: string
): Promise<string | null> {
  const bucket = getMediaBucket();
  if (ORIGIN_FILENAME_RE.test(filename)) {
    return (await bucket.headObject(key)) ? key : null;
  }
  if (!VARIANT_FILENAME_RE.test(filename)) return null;

  const baseKey = mediaBaseKeyFromObjectKey(key);
  if (!baseKey) return null;

  for (const ext of ORIGIN_EXTENSIONS) {
    const candidate = `${baseKey}/origin.${ext}`;
    if (await bucket.headObject(candidate)) return candidate;
  }
  return null;
}

/**
 * Resolve a full origin + 4-variant bundle from any local URL in that bundle.
 * Returns null when the path is not a Telegram/web upload bundle on disk.
 */
export async function resolveLocalMediaBundleFromUrl(
  url: string
): Promise<MediaVariantUrls | null> {
  const trimmed = url.trim();
  if (!isLocalMediaUrl(trimmed)) return null;

  const key = mediaKeyFromUrl(trimmed);
  if (!key) return null;

  const slash = key.lastIndexOf("/");
  if (slash < 0) return null;

  const filename = key.slice(slash + 1);
  const baseKey = key.slice(0, slash);
  const originKey = await resolveOriginKey(key, filename);
  if (!originKey) return null;

  const bucket = getMediaBucket();
  const result: MediaVariantUrls = {
    urlOrigin: bucket.publicUrl(originKey),
    urlPicto: "",
    urlPetite: "",
    urlMoyenne: "",
    urlGrande: "",
  };

  for (const [field, variantFile] of Object.entries(VARIANT_FILES) as Array<
    [keyof typeof VARIANT_FILES, string]
  >) {
    const variantKey = `${baseKey}/${variantFile}`;
    const meta = await bucket.headObject(variantKey);
    if (!meta) return null;
    result[field] = bucket.publicUrl(variantKey);
  }

  return result;
}

export function imageBundleComplete(urls: {
  urlOrigin: string;
  urlPicto?: string | null;
  urlPetite?: string | null;
  urlMoyenne?: string | null;
  urlGrande?: string | null;
}): boolean {
  return Boolean(
    urls.urlOrigin &&
      urls.urlPicto &&
      urls.urlPetite &&
      urls.urlMoyenne &&
      urls.urlGrande
  );
}
