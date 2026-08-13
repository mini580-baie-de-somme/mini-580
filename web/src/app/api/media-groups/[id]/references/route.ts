import { NextRequest, NextResponse } from "next/server";
import { getEditorOrService } from "@/lib/service-auth";
import { findPostsReferencingMediaGroup } from "@/lib/media-groups";
import { prisma } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const editor = await getEditorOrService(_request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const group = await prisma.mediaGroup.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!group) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const posts = await findPostsReferencingMediaGroup(id);
  return NextResponse.json({
    groupId: id,
    posts,
    total: posts.length,
  });
}
