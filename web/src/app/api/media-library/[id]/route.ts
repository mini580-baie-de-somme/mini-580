import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getEditorOrService } from "@/lib/service-auth";
import {
  bakeVariantsFromOrigin,
  deleteMediaUrls,
  type ImageTransformParams,
} from "@/lib/media-variants";
import { deleteMediaById, mediaInclude } from "@/lib/media-library";
import { MediaKind } from "@/generated/prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  titleFr: z.string().optional(),
  titleEn: z.string().optional(),
  descriptionFr: z.string().optional(),
  descriptionEn: z.string().optional(),
  takenAt: z.string().datetime().nullable().optional(),
  focusX: z.number().min(0).max(1).optional(),
  focusY: z.number().min(0).max(1).optional(),
  zoom: z.number().min(0.1).max(5).optional(),
  rotation: z.number().int().optional(),
  cropX: z.number().min(0).max(1).optional(),
  cropY: z.number().min(0).max(1).optional(),
  cropW: z.number().min(0).max(1).optional(),
  cropH: z.number().min(0).max(1).optional(),
  force: z.boolean().optional(),
});

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const media = await prisma.media.findUnique({
    where: { id },
    include: mediaInclude,
  });
  if (!media) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(media);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const editor = await getEditorOrService(request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await prisma.media.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const data = patchSchema.parse(body);

    const transformKeys = [
      "focusX",
      "focusY",
      "zoom",
      "rotation",
      "cropX",
      "cropY",
      "cropW",
      "cropH",
    ] as const;
    const transformChanged = transformKeys.some((k) => data[k] !== undefined);

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
        focusX: data.focusX,
        focusY: data.focusY,
        zoom: data.zoom,
        rotation: data.rotation,
        cropX: data.cropX,
        cropY: data.cropY,
        cropW: data.cropW,
        cropH: data.cropH,
      },
      include: mediaInclude,
    });

    if (transformChanged && updated.kind === MediaKind.IMAGE) {
      const transform: ImageTransformParams = {
        focusX: updated.focusX,
        focusY: updated.focusY,
        zoom: updated.zoom,
        rotation: updated.rotation,
        cropX: updated.cropX,
        cropY: updated.cropY,
        cropW: updated.cropW,
        cropH: updated.cropH,
      };
      try {
        const variants = await bakeVariantsFromOrigin(updated.urlOrigin, transform);
        const rebaked = await prisma.media.update({
          where: { id },
          data: {
            urlPicto: variants.urlPicto,
            urlPetite: variants.urlPetite,
            urlMoyenne: variants.urlMoyenne,
            urlGrande: variants.urlGrande,
          },
          include: mediaInclude,
        });
        await deleteMediaUrls([
          updated.urlPicto,
          updated.urlPetite,
          updated.urlMoyenne,
          updated.urlGrande,
        ]);
        return NextResponse.json(rebaked);
      } catch {
        // keep meta update even if rebake fails
      }
    }

    return NextResponse.json(updated);
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
