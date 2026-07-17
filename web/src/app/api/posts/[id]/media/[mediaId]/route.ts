import { NextRequest, NextResponse } from "next/server";
import { getEditorOrService } from "@/lib/service-auth";
import { detachMediaFromPost } from "@/lib/media-library";
import { prisma } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string; mediaId: string }> };

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const editor = await getEditorOrService(_request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: postId, mediaId } = await context.params;
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ok = await detachMediaFromPost(postId, mediaId);
  if (!ok) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
