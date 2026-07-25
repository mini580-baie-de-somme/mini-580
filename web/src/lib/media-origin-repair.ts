import "server-only";

import { randomUUID } from "node:crypto";
import { MediaKind } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  extensionForContentType,
  getMediaBucket,
  mediaKeyFromUrl,
  normalizeContentType,
} from "@/lib/media-bucket";
import {
  assessMediaIntegrity,
  enrichMediaWithIntegrity,
  isLocalMediaUrl,
} from "@/lib/media-integrity";
import type { MediaIntegrityInput } from "@/lib/media-integrity-types";
import { mediaTrace, newMediaTraceId } from "@/lib/media-trace";
import { mediaInclude } from "@/lib/media-library";

const VARIANT_PRIORITY = [
  "urlGrande",
  "urlMoyenne",
  "urlPetite",
  "urlPicto",
] as const;

type VariantKey = (typeof VARIANT_PRIORITY)[number];

export function pickLocalVariantUrlForRepair(
  media: MediaIntegrityInput
): string | null {
  if (media.kind !== MediaKind.IMAGE && media.kind !== "IMAGE") {
    return null;
  }
  for (const key of VARIANT_PRIORITY) {
    const url = media[key];
    if (!url || !isLocalMediaUrl(url)) continue;
    if (mediaKeyFromUrl(url)) return url;
  }
  return null;
}

/** True when origin is missing locally but a rebaked variant file exists on disk. */
export async function canRepairOriginFromLocalVariant(
  media: MediaIntegrityInput
): Promise<boolean> {
  const integrity = await assessMediaIntegrity(media);
  if (integrity.editable) return false;
  if (integrity.issues.includes("REMOTE_ORIGIN")) return false;

  const candidate = pickLocalVariantUrlForRepair(media);
  if (!candidate) return false;

  const key = mediaKeyFromUrl(candidate);
  if (!key) return false;
  const meta = await getMediaBucket().headObject(key);
  return meta !== null;
}

/**
 * Copy the largest local variant bytes into a new origin file.
 * Explicit repair — not used as a silent rebake fallback.
 */
export async function repairMediaOriginFromLocalVariant(mediaId: string) {
  const trace = { traceId: newMediaTraceId(), mediaId };
  mediaTrace(trace, "originRepair.start", {}, "info");

  const existing = await prisma.media.findUnique({
    where: { id: mediaId },
    include: mediaInclude,
  });
  if (!existing) {
    mediaTrace(trace, "originRepair.notFound", {}, "warn");
    throw new Error("Media not found");
  }
  if (existing.kind !== MediaKind.IMAGE) {
    mediaTrace(trace, "originRepair.unsupportedKind", { kind: existing.kind }, "warn");
    throw new Error("Origin repair applies to images only");
  }

  const integrity = await assessMediaIntegrity(existing);
  if (integrity.editable) {
    mediaTrace(trace, "originRepair.alreadyEditable", {}, "info");
    return enrichMediaWithIntegrity(existing);
  }
  if (integrity.issues.includes("REMOTE_ORIGIN")) {
    mediaTrace(trace, "originRepair.remoteOrigin", {}, "warn");
    const err = new Error(
      "Origin is an external URL — re-upload the file instead of variant repair."
    );
    err.name = "MediaIntegrityError";
    throw err;
  }

  const sourceUrl = pickLocalVariantUrlForRepair(existing);
  if (!sourceUrl) {
    mediaTrace(trace, "originRepair.noLocalVariant", { issues: integrity.issues }, "warn");
    const err = new Error("No local variant available to restore the origin.");
    err.name = "MediaIntegrityError";
    throw err;
  }

  const sourceKey = mediaKeyFromUrl(sourceUrl);
  if (!sourceKey) {
    mediaTrace(trace, "originRepair.badVariantUrl", { sourceUrl }, "error");
    throw new Error("Invalid variant URL");
  }

  const bucket = getMediaBucket();
  const sourceObj = await bucket.getObject(sourceKey);
  if (!sourceObj) {
    mediaTrace(trace, "originRepair.variantMissingOnDisk", { sourceKey }, "error");
    const err = new Error("Variant file missing from storage.");
    err.name = "MediaIntegrityError";
    throw err;
  }

  const ct = normalizeContentType(sourceObj.contentType || existing.mimeType);
  const ext = extensionForContentType(ct) ?? "jpg";
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const originKey = `${yyyy}/${mm}/${randomUUID()}/origin.${ext}`;

  const origin = await bucket.putObject(originKey, sourceObj.body, ct);
  mediaTrace(trace, "originRepair.wroteOrigin", {
    sourceUrl,
    originUrl: origin.url,
    bytes: sourceObj.body.byteLength,
  }, "info");

  const updated = await prisma.media.update({
    where: { id: mediaId },
    data: {
      urlOrigin: origin.url,
      mimeType: ct,
      byteSize: sourceObj.body.byteLength,
    },
    include: mediaInclude,
  });

  const after = await enrichMediaWithIntegrity(updated);
  mediaTrace(trace, "originRepair.done", {
    editable: after.integrity.editable,
    ok: after.integrity.ok,
  }, "info");
  return after;
}
