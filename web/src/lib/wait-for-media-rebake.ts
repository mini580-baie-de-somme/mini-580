/** Poll until server-side async rebake rotates variant URLs (client-only). */

import type { MediaVariantSnapshot } from "@/lib/gallery-editor";

export type RebakePollMedia = {
  id: string;
  urlPicto?: string | null;
  urlPetite?: string | null;
  urlMoyenne?: string | null;
  urlGrande?: string | null;
  updatedAt?: string | null;
};

function variantUrls(
  media: Pick<
    RebakePollMedia,
    "urlPicto" | "urlPetite" | "urlMoyenne" | "urlGrande"
  >
): string[] {
  return [media.urlPicto, media.urlPetite, media.urlMoyenne, media.urlGrande]
    .filter((url): url is string => Boolean(url))
    .map((url) => url.split("?")[0]!);
}

function variantsRotated(
  before: MediaVariantSnapshot,
  after: RebakePollMedia
): boolean {
  const prev = variantUrls(before);
  const next = variantUrls(after);
  return next.length > 0 && (prev.length === 0 || next.some((url) => !prev.includes(url)));
}

export function mediaVariantsChanged(
  before: MediaVariantSnapshot,
  after: RebakePollMedia
): boolean {
  return variantsRotated(before, after);
}

/** Poll until rebake rotates variants relative to the PATCH response (not pre-save draft). */
export async function waitForMediaRebakeAfterPatch<T extends RebakePollMedia>(
  mediaId: string,
  patchResponseVariants: MediaVariantSnapshot,
  opts?: { maxMs?: number; intervalMs?: number }
): Promise<T | null> {
  return waitForMediaRebake<T>(mediaId, patchResponseVariants, opts);
}

export async function waitForMediaRebake<T extends RebakePollMedia>(
  mediaId: string,
  previous: MediaVariantSnapshot,
  opts?: { maxMs?: number; intervalMs?: number }
): Promise<T | null> {
  const maxMs = opts?.maxMs ?? 60_000;
  const intervalMs = opts?.intervalMs ?? 750;
  const deadline = Date.now() + maxMs;

  while (Date.now() < deadline) {
    let res: Response;
    try {
      res = await fetch(`/api/media-library/${mediaId}`, {
        cache: "no-store",
      });
    } catch {
      await new Promise((r) => setTimeout(r, intervalMs));
      continue;
    }
    if (!res.ok) {
      await new Promise((r) => setTimeout(r, intervalMs));
      continue;
    }
    let data: T;
    try {
      data = (await res.json()) as T;
    } catch {
      await new Promise((r) => setTimeout(r, intervalMs));
      continue;
    }
    if (variantsRotated(previous, data)) return data;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

/** Last-chance fetch after poll timeout — layout may be saved even if URLs unchanged. */
export async function fetchMediaAfterRebakeTimeout<T extends RebakePollMedia>(
  mediaId: string
): Promise<T | null> {
  try {
    const res = await fetch(`/api/media-library/${mediaId}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
