import { NextRequest, NextResponse } from "next/server";
import { getEditorOrService } from "@/lib/service-auth";
import { setPostCover } from "@/lib/media-library";
import { prisma } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string; mediaId: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  const editor = await getEditorOrService(_request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: postId, mediaId } = await context.params;
  const link = await prisma.postMedia.findUnique({
    where: { postId_mediaId: { postId, mediaId } },
  });
  if (!link) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  try {
    await setPostCover(postId, mediaId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
