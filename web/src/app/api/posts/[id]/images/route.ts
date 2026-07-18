import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getEditorOrService } from "@/lib/service-auth";
import { postInclude } from "@/lib/posts";
import {
  contentTypeFromFilename,
  isAllowedContentType,
  normalizeContentType,
} from "@/lib/media-bucket";
import { deleteMediaUrls } from "@/lib/media-variants";
import {
  attachMediaToPost,
  createMediaFromUpload,
  createMediaFromUrls,
  listPostMediaAsImages,
} from "@/lib/media-library";
import { optionalNullableDateTime } from "@/lib/date-schema";

type RouteContext = { params: Promise<{ id: string }> };

/** @deprecated Prefer /api/posts/:id/media — kept for Telegram / AI tool compat. */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { id: postId } = await context.params;
  const images = await listPostMediaAsImages(postId);
  return NextResponse.json(images.filter((i) => i.kind === "IMAGE" || true));
}

const imageMetaSchema = z.object({
  urlOrigin: z.string().min(1).optional(),
  urlPicto: z.string().nullable().optional(),
  urlPetite: z.string().nullable().optional(),
  urlMoyenne: z.string().nullable().optional(),
  urlGrande: z.string().nullable().optional(),
  titleFr: z.string().optional(),
  titleEn: z.string().optional(),
  descriptionFr: z.string().optional(),
  descriptionEn: z.string().optional(),
  captionFr: z.string().optional(),
  captionEn: z.string().optional(),
  url: z.string().optional(),
  takenAt: optionalNullableDateTime,
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

const replaceAllSchema = z.object({
  images: z.array(imageMetaSchema),
});

/** Replace all post media links with new Media rows (legacy photos.replace_all). */
export async function PUT(request: NextRequest, context: RouteContext) {
  const editor = await getEditorOrService(request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: postId } = await context.params;
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const data = replaceAllSchema.parse(body);

    const previous = await prisma.postMedia.findMany({
      where: { postId },
      include: { media: true },
    });

    await prisma.postMedia.deleteMany({ where: { postId } });

    // Delete media that are no longer linked anywhere
    for (const link of previous) {
      const stillLinked = await prisma.postMedia.count({
        where: { mediaId: link.mediaId },
      });
      if (stillLinked === 0) {
        await deleteMediaUrls([
          link.media.urlOrigin,
          link.media.urlPicto,
          link.media.urlPetite,
          link.media.urlMoyenne,
          link.media.urlGrande,
        ]);
        await prisma.media.delete({ where: { id: link.mediaId } }).catch(() => null);
      }
    }

    for (let i = 0; i < data.images.length; i++) {
      const img = data.images[i]!;
      const origin = img.urlOrigin ?? img.url ?? "";
      if (!origin) continue;
      const media = await createMediaFromUrls({
        urlOrigin: origin,
        urlPicto: img.urlPicto,
        urlPetite: img.urlPetite,
        urlMoyenne: img.urlMoyenne,
        urlGrande: img.urlGrande,
        titleFr: img.titleFr,
        titleEn: img.titleEn,
        descriptionFr: img.descriptionFr ?? img.captionFr,
        descriptionEn: img.descriptionEn ?? img.captionEn,
        takenAt: img.takenAt ? new Date(img.takenAt) : null,
        focusX: img.focusX,
        focusY: img.focusY,
        zoom: img.zoom,
        rotation: img.rotation,
        cropX: img.cropX,
        cropY: img.cropY,
        cropW: img.cropW,
        cropH: img.cropH,
      });
      await prisma.postMedia.create({
        data: {
          postId,
          mediaId: media.id,
          sortOrder: img.sortOrder ?? i,
          isCover: i === 0,
        },
      });
    }

    if (data.images[0]) {
      const firstOrigin = data.images[0].urlOrigin ?? data.images[0].url;
      if (firstOrigin) {
        await prisma.post.update({
          where: { id: postId },
          data: { coverImageUrl: data.images[0].urlMoyenne ?? firstOrigin },
        });
      }
    } else {
      await prisma.post.update({
        where: { id: postId },
        data: { coverImageUrl: null },
      });
    }

    const full = await prisma.post.findUnique({
      where: { id: postId },
      include: postInclude,
    });
    return NextResponse.json(full);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update images" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const editor = await getEditorOrService(request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: postId } = await context.params;
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    try {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Missing file field" }, { status: 400 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const declared =
        file.type || contentTypeFromFilename(file.name) || "image/jpeg";
      const ct = normalizeContentType(declared);
      if (!isAllowedContentType(ct)) {
        return NextResponse.json({ error: "Unsupported Content-Type" }, { status: 415 });
      }
      const media = await createMediaFromUpload({
        buffer,
        contentType: ct,
        filename: file.name,
        meta: {
          titleFr: typeof form.get("titleFr") === "string" ? String(form.get("titleFr")) : "",
          descriptionFr:
            typeof form.get("descriptionFr") === "string"
              ? String(form.get("descriptionFr"))
              : "",
        },
      });
      await attachMediaToPost(postId, [media.id], {
        setCoverFirst: !post.coverImageUrl,
      });
      const images = await listPostMediaAsImages(postId);
      return NextResponse.json(
        images.find((i) => i.id === media.id),
        { status: 201 }
      );
    } catch (err) {
      console.error("image upload failed", err);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
  }

  try {
    const body = await request.json();
    const data = imageMetaSchema.parse(body);
    const origin = data.urlOrigin ?? data.url ?? "";
    if (!origin) {
      return NextResponse.json({ error: "urlOrigin required" }, { status: 400 });
    }
    const media = await createMediaFromUrls({
      urlOrigin: origin,
      urlPicto: data.urlPicto,
      urlPetite: data.urlPetite,
      urlMoyenne: data.urlMoyenne,
      urlGrande: data.urlGrande,
      titleFr: data.titleFr,
      titleEn: data.titleEn,
      descriptionFr: data.descriptionFr ?? data.captionFr,
      descriptionEn: data.descriptionEn ?? data.captionEn,
      takenAt: data.takenAt ? new Date(data.takenAt) : null,
      focusX: data.focusX,
      focusY: data.focusY,
      zoom: data.zoom,
      rotation: data.rotation,
      cropX: data.cropX,
      cropY: data.cropY,
      cropW: data.cropW,
      cropH: data.cropH,
    });
    await attachMediaToPost(postId, [media.id]);
    if (data.sortOrder !== undefined) {
      await prisma.postMedia.update({
        where: { postId_mediaId: { postId, mediaId: media.id } },
        data: { sortOrder: data.sortOrder },
      });
    }
    const images = await listPostMediaAsImages(postId);
    return NextResponse.json(
      images.find((i) => i.id === media.id),
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create image" }, { status: 500 });
  }
}
