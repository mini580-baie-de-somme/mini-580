import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getEditorOrService } from "@/lib/service-auth";

type RouteContext = { params: Promise<{ id: string; imageId: string }> };

const patchSchema = z.object({
  url: z.string().optional(),
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

export async function PATCH(request: NextRequest, context: RouteContext) {
  const editor = await getEditorOrService(request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: postId, imageId } = await context.params;
  const existing = await prisma.postImage.findFirst({
    where: { id: imageId, postId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const data = patchSchema.parse(body);
    const image = await prisma.postImage.update({
      where: { id: imageId },
      data: {
        ...(data.url !== undefined && { url: data.url }),
        ...(data.titleFr !== undefined && { titleFr: data.titleFr }),
        ...(data.titleEn !== undefined && { titleEn: data.titleEn }),
        ...(data.captionFr !== undefined && { captionFr: data.captionFr }),
        ...(data.captionEn !== undefined && { captionEn: data.captionEn }),
        ...(data.takenAt !== undefined && {
          takenAt: data.takenAt ? new Date(data.takenAt) : null,
        }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
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
    return NextResponse.json(image);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const editor = await getEditorOrService(_request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: postId, imageId } = await context.params;
  const existing = await prisma.postImage.findFirst({
    where: { id: imageId, postId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.postImage.delete({ where: { id: imageId } });
  return NextResponse.json({ ok: true });
}
