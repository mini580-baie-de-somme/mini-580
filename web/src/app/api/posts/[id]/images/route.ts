import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getEditorOrService } from "@/lib/service-auth";
import { postInclude } from "@/lib/posts";

type RouteContext = { params: Promise<{ id: string }> };

const imageSchema = z.object({
  url: z.string().min(1),
  titleFr: z.string().optional(),
  titleEn: z.string().optional(),
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

const replaceAllSchema = z.object({
  images: z.array(imageSchema),
});

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id: postId } = await context.params;
  const images = await prisma.postImage.findMany({
    where: { postId },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(images);
}

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

    await prisma.postImage.deleteMany({ where: { postId } });
    if (data.images.length) {
      await prisma.postImage.createMany({
        data: data.images.map((img, i) => ({
          postId,
          url: img.url,
          titleFr: img.titleFr ?? "",
          titleEn: img.titleEn ?? "",
          captionFr: img.captionFr ?? "",
          captionEn: img.captionEn ?? "",
          takenAt: img.takenAt ? new Date(img.takenAt) : null,
          sortOrder: img.sortOrder ?? i,
          focusX: img.focusX ?? 0.5,
          focusY: img.focusY ?? 0.5,
          zoom: img.zoom ?? 1,
          rotation: img.rotation ?? 0,
          cropX: img.cropX ?? 0,
          cropY: img.cropY ?? 0,
          cropW: img.cropW ?? 1,
          cropH: img.cropH ?? 1,
        })),
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

  try {
    const body = await request.json();
    const data = imageSchema.parse(body);
    const max = await prisma.postImage.aggregate({
      where: { postId },
      _max: { sortOrder: true },
    });

    const image = await prisma.postImage.create({
      data: {
        postId,
        url: data.url,
        titleFr: data.titleFr ?? "",
        titleEn: data.titleEn ?? "",
        captionFr: data.captionFr ?? "",
        captionEn: data.captionEn ?? "",
        takenAt: data.takenAt ? new Date(data.takenAt) : null,
        sortOrder: data.sortOrder ?? (max._max.sortOrder ?? -1) + 1,
        focusX: data.focusX ?? 0.5,
        focusY: data.focusY ?? 0.5,
        zoom: data.zoom ?? 1,
        rotation: data.rotation ?? 0,
        cropX: data.cropX ?? 0,
        cropY: data.cropY ?? 0,
        cropW: data.cropW ?? 1,
        cropH: data.cropH ?? 1,
      },
    });

    return NextResponse.json(image, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create image" }, { status: 500 });
  }
}
