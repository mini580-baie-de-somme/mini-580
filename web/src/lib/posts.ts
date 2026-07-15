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
  images: { orderBy: { sortOrder: "asc" as const } },
} satisfies Prisma.PostInclude;

export type PostWithRelations = Prisma.PostGetPayload<{
  include: typeof postInclude;
}>;

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
