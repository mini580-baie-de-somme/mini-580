import { NextRequest, NextResponse } from "next/server";
import { PostStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { postInclude } from "@/lib/posts";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!session) {
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

  return NextResponse.json(post);
}
