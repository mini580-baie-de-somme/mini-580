import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Hull } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getEditorOrService } from "@/lib/service-auth";
import { validatePlatformAuthorId } from "@/lib/editors";
import { postInclude, uniqueSlug, syncPostRelations, serializePostForApi, loadMilestoneWindows } from "@/lib/posts";
import { milestonesForPostPublishedAt } from "@/lib/milestone-windows";
import { recordSlugChange } from "@/lib/slug-history";
import { optionalNullableDateTime } from "@/lib/date-schema";

type RouteContext = { params: Promise<{ id: string }> };

/** Ignore stale coverImageUrl from autosave when rebake rotated variant URLs. */
async function coverImageUrlLinkedToPost(
  postId: string,
  coverImageUrl: string
): Promise<boolean> {
  const links = await prisma.postMedia.findMany({
    where: { postId },
    include: { media: true },
  });
  return links.some(({ media: m }) =>
    [m.urlOrigin, m.urlMoyenne, m.urlGrande, m.urlPetite, m.urlPicto].includes(
      coverImageUrl
    )
  );
}

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

  const allMilestones = await loadMilestoneWindows();
  return NextResponse.json(
    serializePostForApi(
      post,
      milestonesForPostPublishedAt(post, allMilestones, false)
    )
  );
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
  workDays: z.union([z.number().int().min(0), z.null()]).optional(),
  hulls: z.array(z.nativeEnum(Hull)).optional(),
  tagIds: z.array(z.string()).optional(),
  themeIds: z.array(z.string()).optional(),
  authorId: z.string().optional(),
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

    if (slug !== existing.slug && existing.slug) {
      await recordSlugChange("post", id, existing.slug, slug);
    }

    let authorId: string | undefined;
    if (data.authorId !== undefined) {
      const resolved = await validatePlatformAuthorId(data.authorId);
      if (!resolved) {
        return NextResponse.json({ error: "Invalid author" }, { status: 400 });
      }
      authorId = resolved;
    }

    let coverImageUrlUpdate: string | null | undefined;
    if (data.coverImageUrl !== undefined) {
      if (data.coverImageUrl === null) {
        coverImageUrlUpdate = null;
      } else {
        const linked = await coverImageUrlLinkedToPost(id, data.coverImageUrl);
        if (linked) {
          coverImageUrlUpdate = data.coverImageUrl;
        }
      }
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
        ...(coverImageUrlUpdate !== undefined && {
          coverImageUrl: coverImageUrlUpdate,
        }),
        ...(data.publishedAt !== undefined && {
          publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
        }),
        ...(data.workDays !== undefined && { workDays: data.workDays }),
        ...(authorId !== undefined && { authorId }),
        slug,
      },
    });

    await syncPostRelations(id, {
      hulls: data.hulls,
      tagIds: data.tagIds,
      themeIds: data.themeIds,
    });

    const post = await prisma.post.findUnique({
      where: { id },
      include: postInclude,
    });
    const allMilestones = await loadMilestoneWindows();

    return NextResponse.json(
      post
        ? serializePostForApi(
            post,
            milestonesForPostPublishedAt(post, allMilestones, false)
          )
        : null
    );
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
