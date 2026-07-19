import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getEditorOrService } from "@/lib/service-auth";
import { deleteMediaUrls } from "@/lib/media-variants";
import { layoutFromLegacy, legacyFieldsFromLayout, mergeLayoutPatch } from "@/lib/image-layout";
import {
  deleteMediaById,
  mediaInclude,
  collectPreviousDisplayUrls,
  rebakeMediaVariants,
  syncCoverImageUrlsAfterRebake,
} from "@/lib/media-library";
import { MediaKind } from "@/generated/prisma/client";
import { optionalNullableDateTime } from "@/lib/date-schema";
import {
  MediaRebakeError,
  mediaTrace,
  newMediaTraceId,
  rebakeErrorDetail,
} from "@/lib/media-trace";
import { enrichMediaWithIntegrity } from "@/lib/media-integrity";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  titleFr: z.string().optional(),
  titleEn: z.string().optional(),
  descriptionFr: z.string().optional(),
  descriptionEn: z.string().optional(),
  takenAt: optionalNullableDateTime,
  // New layout editor
  offsetX: z.number().min(-2).max(2).optional(),
  offsetY: z.number().min(-2).max(2).optional(),
  scaleX: z.number().min(0.1).max(8).optional(),
  scaleY: z.number().min(0.1).max(8).optional(),
  lockAspect: z.boolean().optional(),
  rotation: z.number().optional(),
  cropShape: z.enum(["RECT", "CIRCLE"]).optional(),
  backgroundColor: z.string().max(32).optional(),
  cropInset: z.number().min(0).max(0.4).optional(),
  // Legacy
  focusX: z.number().min(0).max(1).optional(),
  focusY: z.number().min(0).max(1).optional(),
  zoom: z.number().min(0.1).max(8).optional(),
  cropX: z.number().min(0).max(1).optional(),
  cropY: z.number().min(0).max(1).optional(),
  cropW: z.number().min(0).max(1).optional(),
  cropH: z.number().min(0).max(1).optional(),
  force: z.boolean().optional(),
});

const LAYOUT_KEYS = [
  "offsetX",
  "offsetY",
  "scaleX",
  "scaleY",
  "lockAspect",
  "rotation",
  "cropShape",
  "backgroundColor",
  "cropInset",
  "focusX",
  "focusY",
  "zoom",
  "cropX",
  "cropY",
  "cropW",
  "cropH",
] as const;

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const media = await prisma.media.findUnique({
    where: { id },
    include: mediaInclude,
  });
  if (!media) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const enriched = await enrichMediaWithIntegrity(media);
  return NextResponse.json(enriched);
}

const NEW_LAYOUT_KEYS = [
  "offsetX",
  "offsetY",
  "scaleX",
  "scaleY",
  "lockAspect",
  "rotation",
  "cropShape",
  "backgroundColor",
  "cropInset",
] as const;

export async function PATCH(request: NextRequest, context: RouteContext) {
  const editor = await getEditorOrService(request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const traceId = newMediaTraceId();
  const trace = { traceId, mediaId: id };
  mediaTrace(trace, "patchMediaLibrary.start", { mediaId: id });

  const existing = await prisma.media.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const data = patchSchema.parse(body);
    const transformChanged = LAYOUT_KEYS.some((k) => data[k] !== undefined);

    const layoutPatch = Object.fromEntries(
      NEW_LAYOUT_KEYS.filter((k) => data[k] !== undefined).map((k) => [k, data[k]])
    ) as Partial<Record<(typeof NEW_LAYOUT_KEYS)[number], unknown>>;
    const legacySync =
      Object.keys(layoutPatch).length > 0
        ? legacyFieldsFromLayout(
            mergeLayoutPatch(existing, layoutPatch as Parameters<typeof mergeLayoutPatch>[1])
          )
        : null;

    // Persist meta first (takenAt/titles/layout fields) before rebake.
    const updated = await prisma.media.update({
      where: { id },
      data: {
        titleFr: data.titleFr,
        titleEn: data.titleEn,
        descriptionFr: data.descriptionFr,
        descriptionEn: data.descriptionEn,
        takenAt:
          data.takenAt === undefined
            ? undefined
            : data.takenAt
              ? new Date(data.takenAt)
              : null,
        offsetX: data.offsetX,
        offsetY: data.offsetY,
        scaleX: data.scaleX,
        scaleY: data.scaleY,
        lockAspect: data.lockAspect,
        rotation: data.rotation,
        cropShape: data.cropShape,
        backgroundColor: data.backgroundColor,
        cropInset: data.cropInset,
        ...(legacySync && {
          focusX: legacySync.focusX,
          focusY: legacySync.focusY,
          zoom: legacySync.zoom,
        }),
        ...(data.focusX !== undefined && { focusX: data.focusX }),
        ...(data.focusY !== undefined && { focusY: data.focusY }),
        ...(data.zoom !== undefined && { zoom: data.zoom }),
        ...(data.cropX !== undefined && { cropX: data.cropX }),
        ...(data.cropY !== undefined && { cropY: data.cropY }),
        ...(data.cropW !== undefined && { cropW: data.cropW }),
        ...(data.cropH !== undefined && { cropH: data.cropH }),
      },
      include: mediaInclude,
    });

    if (transformChanged && updated.kind === MediaKind.IMAGE) {
      const previousDisplayUrls = collectPreviousDisplayUrls(existing);
      const previousVariantUrls = [
        existing.urlPicto,
        existing.urlPetite,
        existing.urlMoyenne,
        existing.urlGrande,
      ];
      try {
        const variants = await rebakeMediaVariants(
          updated,
          {},
          previousVariantUrls,
          trace
        );
        const rebaked = await prisma.media.update({
          where: { id },
          data: variants,
          include: mediaInclude,
        });
        await syncCoverImageUrlsAfterRebake(id, variants, previousDisplayUrls);
        mediaTrace(trace, "patchMediaLibrary.rebake.done", {
          urlMoyenne: rebaked.urlMoyenne,
        });
        return NextResponse.json(await enrichMediaWithIntegrity(rebaked));
      } catch (err) {
        const detail = rebakeErrorDetail(err);
        const step = err instanceof MediaRebakeError ? err.step : "rebake";
        console.error("layout rebake failed (meta already saved)", {
          traceId,
          mediaId: id,
          step,
          detail,
          err,
        });
        return NextResponse.json(
          {
            error:
              err instanceof Error && err.name === "MediaIntegrityError"
                ? detail
                : "Variant rebake failed — layout saved but display sizes were not regenerated",
            traceId,
            detail,
            step,
          },
          { status: err instanceof Error && err.name === "MediaIntegrityError" ? 422 : 500 }
        );
      }
    }

    return NextResponse.json(await enrichMediaWithIntegrity(updated));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const editor = await getEditorOrService(request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const force =
    request.nextUrl.searchParams.get("force") === "1" ||
    request.nextUrl.searchParams.get("force") === "true";

  const result = await deleteMediaById(id, { force });
  if (!result.ok && result.status === 404) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!result.ok && result.status === 409) {
    return NextResponse.json(
      {
        error: "Media is linked to posts — pass force=1 to delete anyway",
        linkedPostCount: result.linkedPostCount,
      },
      { status: 409 }
    );
  }
  return NextResponse.json({ ok: true });
}
