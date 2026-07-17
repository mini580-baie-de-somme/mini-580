import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getEditorOrService } from "@/lib/service-auth";
import { bakeVariantsFromOrigin } from "@/lib/media-variants";
import {
  detachMediaFromPost,
  deleteMediaById,
  listPostMediaAsImages,
  mediaAsPostImage,
} from "@/lib/media-library";

type RouteContext = { params: Promise<{ id: string; imageId: string }> };

const patchSchema = z.object({
  urlOrigin: z.string().optional(),
  urlPicto: z.string().nullable().optional(),
  urlPetite: z.string().nullable().optional(),
  urlMoyenne: z.string().nullable().optional(),
  urlGrande: z.string().nullable().optional(),
  url: z.string().optional(),
  titleFr: z.string().optional(),
  titleEn: z.string().optional(),
  descriptionFr: z.string().optional(),
  descriptionEn: z.string().optional(),
  captionFr: z.string().optional(),
  captionEn: z.string().optional(),
  takenAt: z.string().datetime().nullable().optional(),
  sortOrder: z.number().int().optional(),
  focusX: z.number().min(0).max(1).optional(),
  focusY: z.number().min(0).max(1).optional(),
  zoom: z.number().min(0.1).max(5).optional(),
  rotation: z.number().int().optional(),
  cropX: z.number().min(0).max(1).optional(),
  cropY: z.number().min(0).max(1).optional(),
  cropW: z.number().min(0).max(1).optional(),
  cropH: z.number().min(0).max(1).optional(),
});

const TRANSFORM_KEYS = [
  "focusX",
  "focusY",
  "zoom",
  "rotation",
  "cropX",
  "cropY",
  "cropW",
  "cropH",
] as const;

export async function PATCH(request: NextRequest, context: RouteContext) {
  const editor = await getEditorOrService(request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: postId, imageId } = await context.params;
  const link = await prisma.postMedia.findUnique({
    where: { postId_mediaId: { postId, mediaId: imageId } },
    include: { media: true },
  });
  if (!link) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const existing = link.media;

  try {
    const body = await request.json();
    const data = patchSchema.parse(body);

    const transformChanged = TRANSFORM_KEYS.some((k) => data[k] !== undefined);
    let bakedUrls: {
      urlPicto: string;
      urlPetite: string;
      urlMoyenne: string;
      urlGrande: string;
    } | null = null;

    if (transformChanged) {
      bakedUrls = await bakeVariantsFromOrigin(
        existing.urlOrigin,
        {
          focusX: data.focusX ?? existing.focusX,
          focusY: data.focusY ?? existing.focusY,
          zoom: data.zoom ?? existing.zoom,
          rotation: data.rotation ?? existing.rotation,
          cropX: data.cropX ?? existing.cropX,
          cropY: data.cropY ?? existing.cropY,
          cropW: data.cropW ?? existing.cropW,
          cropH: data.cropH ?? existing.cropH,
        },
        [
          existing.urlPicto,
          existing.urlPetite,
          existing.urlMoyenne,
          existing.urlGrande,
        ]
      );
    }

    const media = await prisma.media.update({
      where: { id: imageId },
      data: {
        ...(data.urlOrigin !== undefined && { urlOrigin: data.urlOrigin }),
        ...(data.url !== undefined && { urlOrigin: data.url }),
        ...(bakedUrls
          ? bakedUrls
          : {
              ...(data.urlPicto !== undefined && { urlPicto: data.urlPicto }),
              ...(data.urlPetite !== undefined && { urlPetite: data.urlPetite }),
              ...(data.urlMoyenne !== undefined && {
                urlMoyenne: data.urlMoyenne,
              }),
              ...(data.urlGrande !== undefined && { urlGrande: data.urlGrande }),
            }),
        ...(data.titleFr !== undefined && { titleFr: data.titleFr }),
        ...(data.titleEn !== undefined && { titleEn: data.titleEn }),
        ...(data.descriptionFr !== undefined && {
          descriptionFr: data.descriptionFr,
        }),
        ...(data.descriptionEn !== undefined && {
          descriptionEn: data.descriptionEn,
        }),
        ...(data.captionFr !== undefined && { descriptionFr: data.captionFr }),
        ...(data.captionEn !== undefined && { descriptionEn: data.captionEn }),
        ...(data.takenAt !== undefined && {
          takenAt: data.takenAt ? new Date(data.takenAt) : null,
        }),
        ...(data.focusX !== undefined && { focusX: data.focusX }),
        ...(data.focusY !== undefined && { focusY: data.focusY }),
        ...(data.zoom !== undefined && { zoom: data.zoom }),
        ...(data.rotation !== undefined && { rotation: data.rotation }),
        ...(data.cropX !== undefined && { cropX: data.cropX }),
        ...(data.cropY !== undefined && { cropY: data.cropY }),
        ...(data.cropW !== undefined && { cropW: data.cropW }),
        ...(data.cropH !== undefined && { cropH: data.cropH }),
      },
    });

    if (data.sortOrder !== undefined) {
      await prisma.postMedia.update({
        where: { postId_mediaId: { postId, mediaId: imageId } },
        data: { sortOrder: data.sortOrder },
      });
    }

    const updatedLink = await prisma.postMedia.findUniqueOrThrow({
      where: { postId_mediaId: { postId, mediaId: imageId } },
    });

    return NextResponse.json(
      mediaAsPostImage(media, { ...updatedLink, postId })
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    console.error("image patch failed", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const editor = await getEditorOrService(request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: postId, imageId } = await context.params;
  const link = await prisma.postMedia.findUnique({
    where: { postId_mediaId: { postId, mediaId: imageId } },
  });
  if (!link) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Legacy photos.delete: detach + delete media if orphaned (force)
  await detachMediaFromPost(postId, imageId);
  const remaining = await prisma.postMedia.count({ where: { mediaId: imageId } });
  if (remaining === 0) {
    await deleteMediaById(imageId, { force: true });
  }
  return new NextResponse(null, { status: 204 });
}
