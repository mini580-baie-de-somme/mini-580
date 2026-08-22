import "server-only";

import { Hull, PostStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { blogPathForSlug, publicBlogUrlForSlug } from "@/lib/site-url";
import {
  milestonesForPostPublishedAt,
  publishedAtRangeForMilestone,
  type MilestoneWindow,
} from "@/lib/milestone-windows";
import { milestoneOrderBy } from "@/lib/milestones";
import { parseHull, slugify } from "@/lib/utils";

export { slugify, parseHull, hullToShort } from "@/lib/utils";

export const postInclude = {
  author: { select: { id: true, name: true, email: true } },
  hulls: true,
  tags: { include: { tag: true } },
  themes: { include: { theme: true } },
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
    offsetX: link.media.offsetX,
    offsetY: link.media.offsetY,
    scaleX: link.media.scaleX,
    scaleY: link.media.scaleY,
    lockAspect: link.media.lockAspect,
    cropShape: link.media.cropShape,
    backgroundColor: link.media.backgroundColor,
    cropInset: link.media.cropInset,
    focusX: link.media.focusX,
    focusY: link.media.focusY,
    zoom: link.media.zoom,
    rotation: link.media.rotation,
    cropX: link.media.cropX,
    cropY: link.media.cropY,
    cropW: link.media.cropW,
    cropH: link.media.cropH,
    cropAspectFormat: link.media.cropAspectFormat,
  }));
  const { mediaLinks: _ml, ...rest } = post;
  return { ...rest, images, mediaLinks: post.mediaLinks };
}

/** Public blog URL when PUBLISHED; null while draft/archived (blog route 404). */
export function publicUrlForPost(post: { slug: string; status: PostStatus }): string | null {
  if (post.status !== PostStatus.PUBLISHED) return null;
  return publicBlogUrlForSlug(post.slug);
}

export function postListSummaryFields(post: {
  slug: string;
  status: PostStatus;
}) {
  return {
    blogPath: blogPathForSlug(post.slug),
    publicUrl: publicUrlForPost(post),
  };
}

export async function loadMilestoneWindows(): Promise<MilestoneWindow[]> {
  return prisma.milestone.findMany({
    orderBy: milestoneOrderBy("fr"),
    select: {
      id: true,
      slug: true,
      titleFr: true,
      titleEn: true,
      milestoneDate: true,
      endDate: true,
    },
  });
}

function serializeInferredMilestones(milestones: MilestoneWindow[]) {
  return milestones.map((m) => ({
    id: m.id,
    slug: m.slug,
    titleFr: m.titleFr,
    titleEn: m.titleEn,
    milestoneDate: m.milestoneDate.toISOString(),
  }));
}

/** Flat tag/theme arrays + date-inferred milestones for API responses and Telegram agent tools. */
export function postRelationFields(
  post: PostWithRelations,
  inferredMilestones: MilestoneWindow[] = []
) {
  return {
    tagIds: post.tags.map((t) => t.tagId),
    themeIds: post.themes.map((t) => t.themeId),
    tags: post.tags.map(({ tag }) => ({
      id: tag.id,
      name: tag.name,
      labelFr: tag.labelFr,
      labelEn: tag.labelEn,
    })),
    themes: post.themes.map(({ theme }) => ({
      id: theme.id,
      slug: theme.slug,
      labelFr: theme.labelFr,
      labelEn: theme.labelEn,
    })),
    milestones: serializeInferredMilestones(inferredMilestones),
  };
}

/** Editor paginated list — lightweight row with taxonomy for agent tools. */
export function serializePostEditorListItem(
  post: PostWithRelations,
  inferredMilestones: MilestoneWindow[] = []
) {
  return {
    id: post.id,
    slug: post.slug,
    titleFr: post.titleFr,
    titleEn: post.titleEn,
    status: post.status,
    updatedAt: post.updatedAt.toISOString(),
    hulls: post.hulls,
    ...postRelationFields(post, inferredMilestones),
    ...postListSummaryFields(post),
  };
}

/** API / agent tool shape: legacy images + shareable blog link fields. */
export function serializePostForApi<T extends PostWithRelations>(
  post: T,
  inferredMilestones: MilestoneWindow[] = []
) {
  const { tags: _tags, themes: _themes, ...rest } = withLegacyImages(post);
  return {
    ...rest,
    ...postRelationFields(post, inferredMilestones),
    ...postListSummaryFields(post),
  };
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
}

const relatedCardInclude = {
  hulls: true,
  themes: { include: { theme: true } },
  tags: { include: { tag: true } },
} satisfies Prisma.PostInclude;

export type RelatedPostCard = Prisma.PostGetPayload<{
  include: typeof relatedCardInclude;
}>;

/** Published posts sharing tags, themes, date-window jalons or hulls — scored by overlap + date proximity. */
export async function findRelatedPosts(
  post: {
    id: string;
    publishedAt: Date | null;
    status: PostStatus;
    hulls: { hull: Hull }[];
    tags: { tagId: string }[];
    themes: { themeId: string }[];
  },
  limit = 3
): Promise<RelatedPostCard[]> {
  const tagIds = post.tags.map((t) => t.tagId);
  const themeIds = post.themes.map((t) => t.themeId);
  const hulls = post.hulls.map((h) => h.hull);

  const allMilestones = await loadMilestoneWindows();
  const sharedMilestones = milestonesForPostPublishedAt(post, allMilestones);

  const overlap: Prisma.PostWhereInput[] = [];
  if (tagIds.length > 0) {
    overlap.push({ tags: { some: { tagId: { in: tagIds } } } });
  }
  if (themeIds.length > 0) {
    overlap.push({ themes: { some: { themeId: { in: themeIds } } } });
  }
  for (const m of sharedMilestones) {
    overlap.push(publishedAtRangeForMilestone(m));
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
    include: relatedCardInclude,
    orderBy: { publishedAt: "desc" },
    take: 24,
  });

  const tagSet = new Set(tagIds);
  const themeSet = new Set(themeIds);
  const sharedMilestoneIds = new Set(sharedMilestones.map((m) => m.id));
  const hullSet = new Set(hulls);
  const originMs = post.publishedAt?.getTime() ?? null;
  const dayMs = 86_400_000;

  const scored = candidates.map((c) => {
    let score = 0;
    for (const t of c.tags) if (tagSet.has(t.tagId)) score += 3;
    for (const th of c.themes) if (themeSet.has(th.themeId)) score += 4;
    for (const m of milestonesForPostPublishedAt(c, allMilestones)) {
      if (sharedMilestoneIds.has(m.id)) score += 5;
    }
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

  return scored.slice(0, limit).map(({ post: c }) => c);
}

const insensitiveContains = (q: string) =>
  ({ contains: q, mode: "insensitive" }) as const;

/** Post-level OR clauses for full-text search (blog, editor list, public API). */
export function postSearchOrConditions(search: string): Prisma.PostWhereInput[] {
  const q = search.trim();
  if (!q) return [];

  const mediaTextOr: Prisma.MediaWhereInput[] = [
    { titleFr: insensitiveContains(q) },
    { titleEn: insensitiveContains(q) },
    { descriptionFr: insensitiveContains(q) },
    { descriptionEn: insensitiveContains(q) },
  ];

  return [
    { titleFr: insensitiveContains(q) },
    { titleEn: insensitiveContains(q) },
    { excerptFr: insensitiveContains(q) },
    { excerptEn: insensitiveContains(q) },
    { bodyFr: insensitiveContains(q) },
    { bodyEn: insensitiveContains(q) },
    { slug: insensitiveContains(q) },
    {
      tags: {
        some: {
          tag: {
            OR: [
              { name: insensitiveContains(q) },
              { labelFr: insensitiveContains(q) },
              { labelEn: insensitiveContains(q) },
            ],
          },
        },
      },
    },
    {
      themes: {
        some: {
          theme: {
            OR: [
              { slug: insensitiveContains(q) },
              { labelFr: insensitiveContains(q) },
              { labelEn: insensitiveContains(q) },
            ],
          },
        },
      },
    },
    {
      mediaLinks: {
        some: {
          media: { OR: mediaTextOr },
        },
      },
    },
  ];
}

/** Posts whose publishedAt falls in a jalon whose title/slug matches the search query. */
export async function milestoneSearchPostConditions(
  search: string
): Promise<Prisma.PostWhereInput[]> {
  const q = search.trim();
  if (!q) return [];

  const milestones = await prisma.milestone.findMany({
    where: {
      OR: [
        { slug: insensitiveContains(q) },
        { titleFr: insensitiveContains(q) },
        { titleEn: insensitiveContains(q) },
        { descriptionFr: insensitiveContains(q) },
        { descriptionEn: insensitiveContains(q) },
      ],
    },
    select: { milestoneDate: true, endDate: true },
  });

  return milestones.map((m) => publishedAtRangeForMilestone(m));
}

export async function publicPostWhere(
  filters?: {
    hull?: string;
    theme?: string;
    tag?: string;
    search?: string;
  }
): Promise<Prisma.PostWhereInput> {
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

  const search = filters?.search?.trim();
  if (search) {
    const searchOr = [
      ...postSearchOrConditions(search),
      ...(await milestoneSearchPostConditions(search)),
    ];
    where.OR = searchOr;
  }

  return where;
}

export async function editorPostWhere(
  filters?: {
    q?: string;
    search?: string;
    status?: string;
    hull?: string;
    theme?: string;
    tag?: string;
  }
): Promise<Prisma.PostWhereInput> {
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
      ...postSearchOrConditions(search),
      ...(await milestoneSearchPostConditions(search)),
    ];
  }

  return where;
}

export function inferMilestonesForPostList(
  posts: PostWithRelations[],
  allMilestones: MilestoneWindow[]
): Map<string, MilestoneWindow[]> {
  const map = new Map<string, MilestoneWindow[]>();
  for (const post of posts) {
    map.set(
      post.id,
      milestonesForPostPublishedAt(post, allMilestones, false)
    );
  }
  return map;
}
