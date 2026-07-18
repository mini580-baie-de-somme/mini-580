import "server-only";

import { Hull, PostStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { parseHull, slugify } from "@/lib/utils";

export { slugify, parseHull, hullToShort } from "@/lib/utils";

export const postInclude = {
  author: { select: { id: true, name: true, email: true } },
  hulls: true,
  tags: { include: { tag: true } },
  themes: { include: { theme: true } },
  milestones: { include: { milestone: true } },
  mediaLinks: {
    orderBy: { sortOrder: "asc" as const },
    include: { media: true },
  },
} satisfies Prisma.PostInclude;

export type PostWithRelations = Prisma.PostGetPayload<{
  include: typeof postInclude;
}>;

/** Flatten mediaLinks → legacy `images` array for UI / sync / Telegram. */
export function withLegacyImages<T extends PostWithRelations>(post: T) {
  const images = post.mediaLinks.map((link) => ({
    id: link.media.id,
    postId: link.postId,
    kind: link.media.kind,
    urlOrigin: link.media.urlOrigin,
    urlPicto: link.media.urlPicto,
    urlPetite: link.media.urlPetite,
    urlMoyenne: link.media.urlMoyenne,
    urlGrande: link.media.urlGrande,
    titleFr: link.media.titleFr,
    titleEn: link.media.titleEn,
    descriptionFr: link.media.descriptionFr,
    descriptionEn: link.media.descriptionEn,
    takenAt: link.media.takenAt,
    sortOrder: link.sortOrder,
    isCover: link.isCover,
    focusX: link.media.focusX,
    focusY: link.media.focusY,
    zoom: link.media.zoom,
    rotation: link.media.rotation,
    cropX: link.media.cropX,
    cropY: link.media.cropY,
    cropW: link.media.cropW,
    cropH: link.media.cropH,
  }));
  const { mediaLinks: _ml, ...rest } = post;
  return { ...rest, images, mediaLinks: post.mediaLinks };
}

export async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const slug = slugify(base) || "article";
  let counter = 0;
  while (true) {
    const candidate = counter === 0 ? slug : `${slug}-${counter}`;
    const existing = await prisma.post.findUnique({ where: { slug: candidate } });
    if (!existing || existing.id === excludeId) return candidate;
    counter++;
  }
}

export async function syncPostRelations(
  postId: string,
  data: {
    hulls?: Hull[];
    tagIds?: string[];
    themeIds?: string[];
    milestoneIds?: string[];
  }
) {
  if (data.hulls !== undefined) {
    await prisma.postHull.deleteMany({ where: { postId } });
    if (data.hulls.length > 0) {
      await prisma.postHull.createMany({
        data: data.hulls.map((hull) => ({ postId, hull })),
      });
    }
  }

  if (data.tagIds !== undefined) {
    await prisma.postTag.deleteMany({ where: { postId } });
    if (data.tagIds.length > 0) {
      await prisma.postTag.createMany({
        data: data.tagIds.map((tagId) => ({ postId, tagId })),
      });
    }
  }

  if (data.themeIds !== undefined) {
    await prisma.postTheme.deleteMany({ where: { postId } });
    if (data.themeIds.length > 0) {
      await prisma.postTheme.createMany({
        data: data.themeIds.map((themeId) => ({ postId, themeId })),
      });
    }
  }

  if (data.milestoneIds !== undefined) {
    await prisma.postMilestone.deleteMany({ where: { postId } });
    if (data.milestoneIds.length > 0) {
      await prisma.postMilestone.createMany({
        data: data.milestoneIds.map((milestoneId) => ({ postId, milestoneId })),
      });
    }
  }
}

const relatedCardInclude = {
  hulls: true,
  themes: { include: { theme: true } },
} satisfies Prisma.PostInclude;

export type RelatedPostCard = Prisma.PostGetPayload<{
  include: typeof relatedCardInclude;
}>;

/** Published posts sharing tags, themes, milestones or hulls — scored by overlap + date proximity. */
export async function findRelatedPosts(
  post: {
    id: string;
    publishedAt: Date | null;
    hulls: { hull: Hull }[];
    tags: { tagId: string }[];
    themes: { themeId: string }[];
    milestones: { milestoneId: string }[];
  },
  limit = 3
): Promise<RelatedPostCard[]> {
  const tagIds = post.tags.map((t) => t.tagId);
  const themeIds = post.themes.map((t) => t.themeId);
  const milestoneIds = post.milestones.map((m) => m.milestoneId);
  const hulls = post.hulls.map((h) => h.hull);

  const overlap: Prisma.PostWhereInput[] = [];
  if (tagIds.length > 0) {
    overlap.push({ tags: { some: { tagId: { in: tagIds } } } });
  }
  if (themeIds.length > 0) {
    overlap.push({ themes: { some: { themeId: { in: themeIds } } } });
  }
  if (milestoneIds.length > 0) {
    overlap.push({ milestones: { some: { milestoneId: { in: milestoneIds } } } });
  }
  if (hulls.length > 0) {
    overlap.push({ hulls: { some: { hull: { in: hulls } } } });
  }

  if (overlap.length === 0) return [];

  const candidates = await prisma.post.findMany({
    where: {
      status: PostStatus.PUBLISHED,
      id: { not: post.id },
      OR: overlap,
    },
    include: {
      ...relatedCardInclude,
      tags: true,
      milestones: true,
    },
    orderBy: { publishedAt: "desc" },
    take: 24,
  });

  const tagSet = new Set(tagIds);
  const themeSet = new Set(themeIds);
  const milestoneSet = new Set(milestoneIds);
  const hullSet = new Set(hulls);
  const originMs = post.publishedAt?.getTime() ?? null;
  const dayMs = 86_400_000;

  const scored = candidates.map((c) => {
    let score = 0;
    for (const t of c.tags) if (tagSet.has(t.tagId)) score += 3;
    for (const th of c.themes) if (themeSet.has(th.themeId)) score += 4;
    for (const m of c.milestones) if (milestoneSet.has(m.milestoneId)) score += 5;
    for (const h of c.hulls) if (hullSet.has(h.hull)) score += 1;

    if (originMs && c.publishedAt) {
      const days = Math.abs(c.publishedAt.getTime() - originMs) / dayMs;
      if (days <= 120) score += Math.max(0, 3 - days / 40);
    }

    return { post: c, score };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aDate = a.post.publishedAt?.getTime() ?? 0;
    const bDate = b.post.publishedAt?.getTime() ?? 0;
    return bDate - aDate;
  });

  return scored.slice(0, limit).map(({ post: c }) => {
    const { tags: _tags, milestones: _milestones, ...card } = c;
    return card;
  });
}

export function publicPostWhere(
  filters?: {
    hull?: string;
    theme?: string;
    tag?: string;
    search?: string;
  }
): Prisma.PostWhereInput {
  const where: Prisma.PostWhereInput = { status: PostStatus.PUBLISHED };

  if (filters?.hull) {
    const hull = parseHull(filters.hull) as Hull | null;
    if (hull) where.hulls = { some: { hull } };
  }

  if (filters?.theme) {
    where.themes = { some: { theme: { slug: filters.theme } } };
  }

  if (filters?.tag) {
    where.tags = { some: { tag: { name: filters.tag } } };
  }

  if (filters?.search) {
    const q = filters.search;
    where.OR = [
      { titleFr: { contains: q, mode: "insensitive" } },
      { titleEn: { contains: q, mode: "insensitive" } },
      { excerptFr: { contains: q, mode: "insensitive" } },
      { excerptEn: { contains: q, mode: "insensitive" } },
      { bodyFr: { contains: q, mode: "insensitive" } },
      { bodyEn: { contains: q, mode: "insensitive" } },
    ];
  }

  return where;
}

export function editorPostWhere(
  filters?: {
    q?: string;
    search?: string;
    status?: string;
    hull?: string;
    theme?: string;
    tag?: string;
  }
): Prisma.PostWhereInput {
  const where: Prisma.PostWhereInput = {};
  const search = filters?.q?.trim() || filters?.search?.trim();

  if (filters?.status && filters.status !== "ALL") {
    const status = filters.status as PostStatus;
    if (Object.values(PostStatus).includes(status)) {
      where.status = status;
    }
  }

  if (filters?.hull) {
    const hull = parseHull(filters.hull) as Hull | null;
    if (hull) where.hulls = { some: { hull } };
  }

  if (filters?.theme) {
    where.themes = { some: { theme: { slug: filters.theme } } };
  }

  if (filters?.tag) {
    where.tags = { some: { tag: { name: filters.tag } } };
  }

  if (search) {
    where.OR = [
      { titleFr: { contains: search, mode: "insensitive" } },
      { titleEn: { contains: search, mode: "insensitive" } },
      { excerptFr: { contains: search, mode: "insensitive" } },
      { excerptEn: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
    ];
  }

  return where;
}
