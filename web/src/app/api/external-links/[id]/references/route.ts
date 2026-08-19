import { NextRequest, NextResponse } from "next/server";
import { getEditorOrService } from "@/lib/service-auth";
import { findPostsReferencingExternalLink } from "@/lib/external-links";
import { prisma } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const editor = await getEditorOrService(_request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const link = await prisma.externalLink.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!link) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const posts = await findPostsReferencingExternalLink(id);
  return NextResponse.json({
    linkId: id,
    posts,
    total: posts.length,
  });
}
