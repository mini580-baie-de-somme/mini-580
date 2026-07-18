import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getEditorOrService } from "@/lib/service-auth";
import {
  contentTypeFromFilename,
  isAllowedContentType,
  normalizeContentType,
} from "@/lib/media-bucket";
import {
  attachMediaToPost,
  createMediaFromUpload,
  createMediaFromUrls,
  listPostMediaAsImages,
} from "@/lib/media-library";
import { MediaKind } from "@/generated/prisma/client";
import { optionalNullableDateTime } from "@/lib/date-schema";

type RouteContext = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id: postId } = await context.params;
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const links = await prisma.postMedia.findMany({
    where: { postId },
    include: { media: true },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(
    links.map((l) => ({
      ...l.media,
      sortOrder: l.sortOrder,
      isCover: l.isCover,
      postId,
    }))
  );
}

const attachSchema = z.object({
  mediaIds: z.array(z.string()).min(1),
  setCoverFirst: z.boolean().optional(),
});

const createUrlSchema = z.object({
  urlOrigin: z.string().min(1).optional(),
  url: z.string().optional(),
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
  kind: z.nativeEnum(MediaKind).optional(),
  mimeType: z.string().optional(),
  takenAt: optionalNullableDateTime,
  setCover: z.boolean().optional(),
});

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

  const contentTypeHeader = request.headers.get("content-type") ?? "";

  try {
    if (contentTypeHeader.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Missing file field" }, { status: 400 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const declared =
        file.type || contentTypeFromFilename(file.name) || "";
      const contentType = normalizeContentType(declared);
      if (!isAllowedContentType(contentType)) {
        return NextResponse.json({ error: "Unsupported type" }, { status: 415 });
      }

      const takenRaw = form.get("takenAt");
      const media = await createMediaFromUpload({
        buffer,
        contentType,
        filename: file.name,
        meta: {
          titleFr: String(form.get("titleFr") ?? ""),
          titleEn: String(form.get("titleEn") ?? ""),
          descriptionFr: String(form.get("descriptionFr") ?? ""),
          descriptionEn: String(form.get("descriptionEn") ?? ""),
          takenAt:
            typeof takenRaw === "string" && takenRaw
              ? new Date(takenRaw)
              : null,
        },
      });
      await attachMediaToPost(postId, [media.id], { setCoverFirst: !post.coverImageUrl });
      const images = await listPostMediaAsImages(postId);
      return NextResponse.json(
        images.find((i) => i.id === media.id) ?? media,
        { status: 201 }
      );
    }

    const body = await request.json();

    if (Array.isArray(body.mediaIds)) {
      const data = attachSchema.parse(body);
      await attachMediaToPost(postId, data.mediaIds, {
        setCoverFirst: data.setCoverFirst,
      });
      const linked = await prisma.postMedia.findMany({
        where: { postId, mediaId: { in: data.mediaIds } },
        include: { media: true },
        orderBy: { sortOrder: "asc" },
      });
      return NextResponse.json(
        linked.map((l) => ({
          ...l.media,
          sortOrder: l.sortOrder,
          isCover: l.isCover,
          postId,
        })),
        { status: 201 }
      );
    }

    const data = createUrlSchema.parse(body);
    const origin = data.urlOrigin ?? data.url ?? "";
    if (!origin) {
      return NextResponse.json({ error: "urlOrigin required" }, { status: 400 });
    }
    const media = await createMediaFromUrls({
      kind: data.kind,
      mimeType: data.mimeType,
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
    });
    await attachMediaToPost(postId, [media.id], {
      setCoverFirst: data.setCover || !post.coverImageUrl,
    });
    const images = await listPostMediaAsImages(postId);
    return NextResponse.json(
      images.find((i) => i.id === media.id) ?? media,
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
