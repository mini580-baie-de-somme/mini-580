import { NextRequest, NextResponse } from "next/server";
import { getEditorOrService } from "@/lib/service-auth";
import { prisma } from "@/lib/db";
import { createPreviewLink } from "@/lib/telegram/publish-flow";

type RouteContext = { params: Promise<{ id: string }> };

/** POST /api/posts/:id/preview — temporary shareable preview URL (72h). */
export async function POST(request: NextRequest, context: RouteContext) {
  const editor = await getEditorOrService(request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true, titleFr: true, status: true },
  });
  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = await createPreviewLink(id);
  return NextResponse.json({
    postId: post.id,
    titleFr: post.titleFr,
    status: post.status,
    previewUrl: url,
    expiresInHours: 72,
  });
}
