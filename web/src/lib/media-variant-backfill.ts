import "server-only";

import { MediaKind } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  imageBundleComplete,
  resolveLocalMediaBundleFromUrl,
} from "@/lib/media-local-bundle";
import { assessMediaIntegrity, isLocalMediaUrl } from "@/lib/media-integrity";
import { mediaTrace, newMediaTraceId } from "@/lib/media-trace";

export type BackfillMediaVariantsResult = {
  scanned: number;
  updated: number;
  skipped: number;
  failed: Array<{ id: string; reason: string }>;
};

/**
 * Fill missing IMAGE variant URLs from files already on disk (Telegram ingest gap).
 * Idempotent — skips rows that already have a complete bundle in DB.
 */
export async function backfillIncompleteMediaVariants(opts?: {
  dryRun?: boolean;
  limit?: number;
}): Promise<BackfillMediaVariantsResult> {
  const dryRun = opts?.dryRun ?? false;
  const traceId = newMediaTraceId();

  const candidates = await prisma.media.findMany({
    where: {
      kind: MediaKind.IMAGE,
      OR: [{ urlPicto: null }, { urlPetite: null }, { urlGrande: null }],
    },
    ...(opts?.limit ? { take: opts.limit } : {}),
    orderBy: { createdAt: "asc" },
  });

  const result: BackfillMediaVariantsResult = {
    scanned: candidates.length,
    updated: 0,
    skipped: 0,
    failed: [],
  };

  mediaTrace(
    { traceId },
    "mediaVariantBackfill.start",
    { scanned: result.scanned, dryRun },
    "info"
  );

  for (const media of candidates) {
    if (imageBundleComplete(media)) {
      result.skipped++;
      continue;
    }

    const seed = media.urlOrigin?.trim() || media.urlMoyenne?.trim() || "";
    if (!seed || !isLocalMediaUrl(seed)) {
      result.failed.push({ id: media.id, reason: "NO_LOCAL_ORIGIN" });
      continue;
    }

    const bundle = await resolveLocalMediaBundleFromUrl(seed);
    if (!bundle) {
      result.failed.push({ id: media.id, reason: "BUNDLE_NOT_ON_DISK" });
      continue;
    }

    if (dryRun) {
      result.updated++;
      continue;
    }

    const updated = await prisma.media.update({
      where: { id: media.id },
      data: {
        urlOrigin: bundle.urlOrigin,
        urlPicto: bundle.urlPicto,
        urlPetite: bundle.urlPetite,
        urlMoyenne: bundle.urlMoyenne,
        urlGrande: bundle.urlGrande,
      },
    });

    const integrity = await assessMediaIntegrity(updated);
    if (!integrity.ok || !integrity.editable) {
      result.failed.push({
        id: media.id,
        reason: integrity.issues.join(",") || "NOT_EDITABLE",
      });
      continue;
    }

    result.updated++;
    mediaTrace(
      { traceId, mediaId: media.id },
      "mediaVariantBackfill.updated",
      { urlOrigin: updated.urlOrigin },
      "info"
    );
  }

  mediaTrace(
    { traceId },
    "mediaVariantBackfill.done",
    {
      updated: result.updated,
      skipped: result.skipped,
      failed: result.failed.length,
    },
    "info"
  );

  return result;
}
