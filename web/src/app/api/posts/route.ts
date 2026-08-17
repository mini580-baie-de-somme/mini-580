import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PostStatus, Hull } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getEditorOrService } from "@/lib/service-auth";
import { validatePlatformAuthorId } from "@/lib/editors";
import {
  editorPostWhere,
  postInclude,
  publicPostWhere,
  uniqueSlug,
  syncPostRelations,
  serializePostForApi,
  serializePostEditorListItem,
  loadMilestoneWindows,
  inferMilestonesForPostList,
} from "@/lib/posts";
import { milestonesForPostPublishedAt } from "@/lib/milestone-windows";
import { EDITOR_POSTS_PAGE_SIZE } from "@/lib/constants";
import { getSyncEnv, isSyncConfigured, peerFetch } from "@/lib/sync-crypto";
import type { SyncPostSummary } from "@/lib/sync";
import { optionalNullableDateTime } from "@/lib/date-schema";

const createPostSchema = z.object({
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

export async function GET(request: NextRequest) {
  const editor = await getEditorOrService(request);
  const { searchParams } = request.nextUrl;
  const hull = searchParams.get("hull") ?? undefined;
  const theme = searchParams.get("theme") ?? undefined;
  const tag = searchParams.get("tag") ?? undefined;
  const search = searchParams.get("search") ?? undefined;

  if (editor) {
    const q = searchParams.get("q") ?? searchParams.get("search") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(searchParams.get("limit") ?? String(EDITOR_POSTS_PAGE_SIZE), 10) || EDITOR_POSTS_PAGE_SIZE)
    );
    const offset = Math.max(0, Number.parseInt(searchParams.get("offset") ?? "0", 10) || 0);
    const where = await editorPostWhere({ q, status, hull, theme, tag });

    const [posts, total, totalAll, allMilestones] = await Promise.all([
      prisma.post.findMany({
        where,
        include: postInclude,
        orderBy: { updatedAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.post.count({ where }),
      prisma.post.count(),
      loadMilestoneWindows(),
    ]);

    const inferred = inferMilestonesForPostList(posts, allMilestones);

    let prodIds = new Set<string>();
    if (getSyncEnv() === "test" && isSyncConfigured()) {
      try {
        const res = await peerFetch("/api/sync/peer/export?resource=summaries", "export");
        if (res.ok) {
          const peer = (await res.json()) as SyncPostSummary[];
          prodIds = new Set(peer.map((p) => p.id));
        }
      } catch {
        // Peer unreachable — omit onProd hints
      }
    }

    return NextResponse.json({
      items: posts.map((p) => ({
        ...serializePostEditorListItem(p, inferred.get(p.id)),
        ...(prodIds.size > 0 ? { onProd: prodIds.has(p.id) } : {}),
      })),
      total,
      totalAll,
      limit,
      offset,
    });
  }

  const [posts, allMilestones] = await Promise.all([
    prisma.post.findMany({
      where: await publicPostWhere({ hull, theme, tag, search }),
      include: postInclude,
      orderBy: { publishedAt: "desc" },
    }),
    loadMilestoneWindows(),
  ]);
  const inferred = inferMilestonesForPostList(posts, allMilestones);
  return NextResponse.json(
    posts.map((p) => serializePostForApi(p, inferred.get(p.id)))
  );
}

export async function POST(request: NextRequest) {
  const editor = await getEditorOrService(request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const raw = await request.json().catch(() => ({}));
    const data = createPostSchema.parse(raw ?? {});
    const titleFr = data.titleFr?.trim() || "Nouvel article";
    const titleEn = data.titleEn?.trim() || "New article";
    // Slug is always auto-generated from title — never taken from the client.
    const slug = await uniqueSlug(titleFr);

    let authorId = editor.id;
    const session = await getSession();
    if (session && data.authorId) {
      const resolved = await validatePlatformAuthorId(data.authorId);
      if (!resolved) {
        return NextResponse.json({ error: "Invalid author" }, { status: 400 });
      }
      authorId = resolved;
    }

    const post = await prisma.post.create({
      data: {
        slug,
        titleFr,
        titleEn,
        excerptFr: data.excerptFr ?? "",
        excerptEn: data.excerptEn ?? "",
        bodyFr: data.bodyFr ?? "",
        bodyEn: data.bodyEn ?? "",
        coverImageUrl: data.coverImageUrl ?? null,
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
        workDays: data.workDays ?? null,
        authorId,
        status: PostStatus.DRAFT,
      },
      include: postInclude,
    });

    await syncPostRelations(post.id, {
      hulls: data.hulls,
      tagIds: data.tagIds,
      themeIds: data.themeIds,
    });

    const full = await prisma.post.findUnique({
      where: { id: post.id },
      include: postInclude,
    });
    const allMilestones = await loadMilestoneWindows();

    return NextResponse.json(
      full ? serializePostForApi(full, milestonesForPostPublishedAt(full, allMilestones, false)) : null,
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
  }
}
