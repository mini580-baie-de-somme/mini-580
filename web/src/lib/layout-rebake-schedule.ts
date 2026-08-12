import "server-only";

import { after } from "next/server";
import { prisma } from "@/lib/db";
import {
  collectPreviousDisplayUrls,
  rebakeMediaVariants,
  syncCoverImageUrlsAfterRebake,
} from "@/lib/media-library";
import {
  MediaRebakeError,
  mediaTrace,
  rebakeErrorDetail,
  type MediaTraceContext,
} from "@/lib/media-trace";

type RebakeInput = Parameters<typeof rebakeMediaVariants>[0];

/** Prod: rebake after HTTP response (avoids mobile PATCH timeouts). Test/dev: inline rebake. */
export function rebakeAsyncAfterResponse(): boolean {
  return process.env.NODE_ENV === "production";
}

export type LayoutRebakeResult =
  | { mode: "sync"; rebakePending: false }
  | { mode: "async"; rebakePending: true };

/**
 * Rebake display variants from persisted layout.
 * In production the work is scheduled with `after()` so PATCH can return immediately.
 */
export async function runLayoutRebake(
  media: RebakeInput,
  trace: MediaTraceContext,
  previousVariantUrls: (string | null | undefined)[]
): Promise<LayoutRebakeResult> {
  const previousDisplayUrls = collectPreviousDisplayUrls(media);

  const rebake = async () => {
    mediaTrace(trace, "layoutRebake.start", { mediaId: media.id }, "info");
    try {
      const bakedUrls = await rebakeMediaVariants(
        media,
        {},
        previousVariantUrls,
        trace
      );
      await prisma.media.update({
        where: { id: media.id },
        data: bakedUrls,
      });
      await syncCoverImageUrlsAfterRebake(
        media.id,
        bakedUrls,
        previousDisplayUrls
      );
      mediaTrace(trace, "layoutRebake.done", {
        mediaId: media.id,
        urlMoyenne: bakedUrls.urlMoyenne,
      }, "warn");
    } catch (err) {
      const detail = rebakeErrorDetail(err);
      const step = err instanceof MediaRebakeError ? err.step : "rebake";
      console.error("layout rebake failed (layout already saved)", {
        traceId: trace.traceId,
        mediaId: media.id,
        step,
        detail,
        err,
      });
      mediaTrace(trace, "layoutRebake.failed", { step, detail }, "error");
    }
  };

  if (rebakeAsyncAfterResponse()) {
    after(rebake);
    return { mode: "async", rebakePending: true };
  }

  await rebake();
  return { mode: "sync", rebakePending: false };
}
