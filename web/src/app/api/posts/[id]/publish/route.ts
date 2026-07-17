import { NextRequest, NextResponse } from "next/server";
import { PostStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getEditorOrService } from "@/lib/service-auth";
import { postInclude, withLegacyImages } from "@/lib/posts";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const editor = await getEditorOrService(request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await prisma.post.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const post = await prisma.post.update({
    where: { id },
    data: {
      status: PostStatus.PUBLISHED,
      publishedAt: existing.publishedAt ?? new Date(),
    },
    include: postInclude,
  });

  return NextResponse.json(withLegacyImages(post));
}
