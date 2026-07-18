import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Hull } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getEditorOrService } from "@/lib/service-auth";
import { postInclude, uniqueSlug, syncPostRelations, withLegacyImages } from "@/lib/posts";
import { optionalNullableDateTime } from "@/lib/date-schema";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const editor = await getEditorOrService(request);

  const post = await prisma.post.findFirst({
    where: editor ? { id } : { id, status: "PUBLISHED" },
    include: postInclude,
  });

  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(withLegacyImages(post));
}

const updateSchema = z.object({
  titleFr: z.string().optional(),
  titleEn: z.string().optional(),
  excerptFr: z.string().optional(),
  excerptEn: z.string().optional(),
  bodyFr: z.string().optional(),
  bodyEn: z.string().optional(),
  slug: z.string().optional(),
  coverImageUrl: z.string().nullable().optional(),
  publishedAt: optionalNullableDateTime,
  hulls: z.array(z.nativeEnum(Hull)).optional(),
  tagIds: z.array(z.string()).optional(),
  themeIds: z.array(z.string()).optional(),
  milestoneIds: z.array(z.string()).optional(),
});

export async function PATCH(request: NextRequest, context: RouteContext) {
  const editor = await getEditorOrService(request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await prisma.post.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);

    let slug = existing.slug;
    // Slug is never manually editable. While DRAFT, keep it in sync with titleFr.
    // Once published/archived, freeze to avoid broken public URLs / SEO 404s.
    if (
      existing.status === "DRAFT" &&
      data.titleFr !== undefined &&
      data.titleFr.trim()
    ) {
      slug = await uniqueSlug(data.titleFr, id);
    }

    await prisma.post.update({
      where: { id },
      data: {
        ...(data.titleFr !== undefined && { titleFr: data.titleFr }),
        ...(data.titleEn !== undefined && { titleEn: data.titleEn }),
        ...(data.excerptFr !== undefined && { excerptFr: data.excerptFr }),
        ...(data.excerptEn !== undefined && { excerptEn: data.excerptEn }),
        ...(data.bodyFr !== undefined && { bodyFr: data.bodyFr }),
        ...(data.bodyEn !== undefined && { bodyEn: data.bodyEn }),
        ...(data.coverImageUrl !== undefined && { coverImageUrl: data.coverImageUrl }),
        ...(data.publishedAt !== undefined && {
          publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
        }),
        slug,
      },
    });

    await syncPostRelations(id, {
      hulls: data.hulls,
      tagIds: data.tagIds,
      themeIds: data.themeIds,
      milestoneIds: data.milestoneIds,
    });

    const post = await prisma.post.findUnique({
      where: { id },
      include: postInclude,
    });

    return NextResponse.json(post ? withLegacyImages(post) : null);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const editor = await getEditorOrService(request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  await prisma.post.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
