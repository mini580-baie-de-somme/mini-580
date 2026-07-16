import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getEditorOrService } from "@/lib/service-auth";

type RouteContext = { params: Promise<{ id: string }> };

const reorderSchema = z.object({
  imageIds: z.array(z.string().min(1)).min(1),
});

/** PUT /api/posts/:id/images/reorder — { imageIds: string[] } in desired order */
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
    const { imageIds } = reorderSchema.parse(body);

    const existing = await prisma.postImage.findMany({
      where: { postId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((i) => i.id));
    if (
      imageIds.length !== existingIds.size ||
      imageIds.some((id) => !existingIds.has(id))
    ) {
      return NextResponse.json(
        { error: "imageIds must list every image of the post exactly once" },
        { status: 400 }
      );
    }

    await prisma.$transaction(
      imageIds.map((id, sortOrder) =>
        prisma.postImage.update({ where: { id }, data: { sortOrder } })
      )
    );

    const images = await prisma.postImage.findMany({
      where: { postId },
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json(images);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Reorder failed" }, { status: 500 });
  }
}
