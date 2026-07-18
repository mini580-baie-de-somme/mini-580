import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getEditorOrService } from "@/lib/service-auth";
import { bakeVariantsFromOrigin } from "@/lib/media-variants";
import { layoutFromLegacy } from "@/lib/image-layout";
import {
  detachMediaFromPost,
  deleteMediaById,
  mediaAsPostImage,
} from "@/lib/media-library";
import { optionalNullableDateTime } from "@/lib/date-schema";

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
  takenAt: optionalNullableDateTime,
  sortOrder: z.number().int().optional(),
  offsetX: z.number().min(-2).max(2).optional(),
  offsetY: z.number().min(-2).max(2).optional(),
  scaleX: z.number().min(0.1).max(8).optional(),
  scaleY: z.number().min(0.1).max(8).optional(),
  lockAspect: z.boolean().optional(),
  rotation: z.number().optional(),
  cropShape: z.enum(["RECT", "CIRCLE"]).optional(),
  backgroundColor: z.string().max(32).optional(),
  cropInset: z.number().min(0).max(0.4).optional(),
  focusX: z.number().min(0).max(1).optional(),
  focusY: z.number().min(0).max(1).optional(),
  zoom: z.number().min(0.1).max(8).optional(),
  cropX: z.number().min(0).max(1).optional(),
  cropY: z.number().min(0).max(1).optional(),
  cropW: z.number().min(0).max(1).optional(),
  cropH: z.number().min(0).max(1).optional(),
});

const TRANSFORM_KEYS = [
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

  try {
    const body = await request.json();
    const data = patchSchema.parse(body);

    // Persist meta (incl. takenAt) first so a rebake failure cannot drop the date.
    const media = await prisma.media.update({
      where: { id: imageId },
      data: {
        ...(data.urlOrigin !== undefined && { urlOrigin: data.urlOrigin }),
        ...(data.url !== undefined && { urlOrigin: data.url }),
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
        ...(data.offsetX !== undefined && { offsetX: data.offsetX }),
        ...(data.offsetY !== undefined && { offsetY: data.offsetY }),
        ...(data.scaleX !== undefined && { scaleX: data.scaleX }),
        ...(data.scaleY !== undefined && { scaleY: data.scaleY }),
        ...(data.lockAspect !== undefined && { lockAspect: data.lockAspect }),
        ...(data.rotation !== undefined && { rotation: data.rotation }),
        ...(data.cropShape !== undefined && { cropShape: data.cropShape }),
        ...(data.backgroundColor !== undefined && {
          backgroundColor: data.backgroundColor,
        }),
        ...(data.cropInset !== undefined && { cropInset: data.cropInset }),
        ...(data.focusX !== undefined && { focusX: data.focusX }),
        ...(data.focusY !== undefined && { focusY: data.focusY }),
        ...(data.zoom !== undefined && { zoom: data.zoom }),
        ...(data.cropX !== undefined && { cropX: data.cropX }),
        ...(data.cropY !== undefined && { cropY: data.cropY }),
        ...(data.cropW !== undefined && { cropW: data.cropW }),
        ...(data.cropH !== undefined && { cropH: data.cropH }),
      },
    });

    const transformChanged = TRANSFORM_KEYS.some((k) => data[k] !== undefined);
    let finalMedia = media;

    if (transformChanged && media.kind === "IMAGE") {
      try {
        const merged = layoutFromLegacy(media);
        const bakedUrls = await bakeVariantsFromOrigin(media.urlOrigin, merged, [
          media.urlPicto,
          media.urlPetite,
          media.urlMoyenne,
          media.urlGrande,
        ]);
        finalMedia = await prisma.media.update({
          where: { id: imageId },
          data: bakedUrls,
        });
      } catch (err) {
        console.error("image layout rebake failed (meta already saved)", err);
      }
    }

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
      mediaAsPostImage(finalMedia, { ...updatedLink, postId })
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

  await detachMediaFromPost(postId, imageId);
  const remaining = await prisma.postMedia.count({ where: { mediaId: imageId } });
  if (remaining === 0) {
    await deleteMediaById(imageId, { force: true });
  }
  return new NextResponse(null, { status: 204 });
}
