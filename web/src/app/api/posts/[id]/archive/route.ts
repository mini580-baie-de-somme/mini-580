import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PostStatus } from "@/generated/prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { postInclude } from "@/lib/posts";

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  archived: z.boolean().default(true),
});

/** Archive / unarchive a post (soft delete). */
export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await prisma.post.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { archived } = bodySchema.parse(await request.json().catch(() => ({})));
    const post = await prisma.post.update({
      where: { id },
      data: {
        status: archived ? PostStatus.ARCHIVED : PostStatus.DRAFT,
        publishedAt: archived ? null : existing.publishedAt,
      },
      include: postInclude,
    });
    return NextResponse.json(post);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Archive failed" }, { status: 500 });
  }
}
