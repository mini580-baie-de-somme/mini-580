import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getEditorOrService } from "@/lib/service-auth";
import {
  findPostsReferencingMediaGroup,
  getMediaGroupDetail,
  mediaGroupInclude,
  replaceMediaGroupMembers,
  updateMediaGroupSchema,
  updateMediaGroupSlug,
} from "@/lib/media-groups";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const editor = await getEditorOrService(_request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const group = await getMediaGroupDetail(id);
  if (!group) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(group);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const editor = await getEditorOrService(request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await prisma.mediaGroup.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const data = updateMediaGroupSchema.parse(body);

    let slug = existing.slug;
    if (data.slug !== undefined && data.slug.trim() && data.slug.trim() !== existing.slug) {
      slug = await updateMediaGroupSlug(id, existing.slug, data.slug.trim());
    }

    await prisma.mediaGroup.update({
      where: { id },
      data: {
        ...(data.titleFr !== undefined && { titleFr: data.titleFr }),
        ...(data.titleEn !== undefined && { titleEn: data.titleEn }),
        ...(data.layout !== undefined && { layout: data.layout }),
        slug,
      },
    });

    if (data.mediaIds !== undefined) {
      await replaceMediaGroupMembers(id, data.mediaIds);
    }

    const group = await getMediaGroupDetail(id);
    return NextResponse.json(group);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const editor = await getEditorOrService(_request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await prisma.mediaGroup.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const refs = await findPostsReferencingMediaGroup(id);
  if (refs.length > 0) {
    return NextResponse.json(
      {
        error: "Media group is referenced in article bodies — remove placeholders first",
        referencedByPostIds: refs.map((p) => p.id),
        referencedByPosts: refs,
      },
      { status: 409 }
    );
  }

  await prisma.mediaGroup.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
