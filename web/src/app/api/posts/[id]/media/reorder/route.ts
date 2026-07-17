import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getEditorOrService } from "@/lib/service-auth";

type RouteContext = { params: Promise<{ id: string }> };

const reorderSchema = z.object({
  mediaIds: z.array(z.string()).min(1),
});

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
    const { mediaIds } = reorderSchema.parse(body);

    await prisma.$transaction(
      mediaIds.map((mediaId, sortOrder) =>
        prisma.postMedia.update({
          where: { postId_mediaId: { postId, mediaId } },
          data: { sortOrder },
        })
      )
    );

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
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Reorder failed" }, { status: 500 });
  }
}
