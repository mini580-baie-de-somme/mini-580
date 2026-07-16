import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PostStatus, Hull } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getEditorOrService } from "@/lib/service-auth";
import {
  postInclude,
  publicPostWhere,
  uniqueSlug,
  syncPostRelations,
} from "@/lib/posts";

const createPostSchema = z.object({
  titleFr: z.string().min(1),
  titleEn: z.string().min(1),
  excerptFr: z.string().optional(),
  excerptEn: z.string().optional(),
  bodyFr: z.string().optional(),
  bodyEn: z.string().optional(),
  slug: z.string().optional(),
  coverImageUrl: z.string().nullable().optional(),
  publishedAt: z.string().datetime().nullable().optional(),
  hulls: z.array(z.nativeEnum(Hull)).optional(),
  tagIds: z.array(z.string()).optional(),
  themeIds: z.array(z.string()).optional(),
  milestoneIds: z.array(z.string()).optional(),
});

export async function GET(request: NextRequest) {
  const editor = await getEditorOrService(request);
  const { searchParams } = request.nextUrl;
  const hull = searchParams.get("hull") ?? undefined;
  const theme = searchParams.get("theme") ?? undefined;
  const tag = searchParams.get("tag") ?? undefined;
  const search = searchParams.get("search") ?? undefined;

  if (editor) {
    const posts = await prisma.post.findMany({
      include: postInclude,
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(posts);
  }

  const posts = await prisma.post.findMany({
    where: publicPostWhere({ hull, theme, tag, search }),
    include: postInclude,
    orderBy: { publishedAt: "desc" },
  });
  return NextResponse.json(posts);
}

export async function POST(request: NextRequest) {
  const editor = await getEditorOrService(request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = createPostSchema.parse(body);
    const slug = data.slug
      ? await uniqueSlug(data.slug)
      : await uniqueSlug(data.titleFr);

    const post = await prisma.post.create({
      data: {
        slug,
        titleFr: data.titleFr,
        titleEn: data.titleEn,
        excerptFr: data.excerptFr ?? "",
        excerptEn: data.excerptEn ?? "",
        bodyFr: data.bodyFr ?? "",
        bodyEn: data.bodyEn ?? "",
        coverImageUrl: data.coverImageUrl ?? null,
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
        authorId: editor.id,
        status: PostStatus.DRAFT,
      },
      include: postInclude,
    });

    await syncPostRelations(post.id, {
      hulls: data.hulls,
      tagIds: data.tagIds,
      themeIds: data.themeIds,
      milestoneIds: data.milestoneIds,
    });

    const full = await prisma.post.findUnique({
      where: { id: post.id },
      include: postInclude,
    });

    return NextResponse.json(full, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
  }
}
