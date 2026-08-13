import "server-only";

import { z } from "zod";
import { MediaGroupLayout, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { mediaGroupPlaceholder } from "@/lib/media-group-token";
import { slugify } from "@/lib/utils";

export const mediaGroupInclude = {
  members: {
    orderBy: { sortOrder: "asc" as const },
    include: { media: true },
  },
} satisfies Prisma.MediaGroupInclude;

export type MediaGroupWithMembers = Prisma.MediaGroupGetPayload<{
  include: typeof mediaGroupInclude;
}>;

export function mediaGroupWhere(q?: string): Prisma.MediaGroupWhereInput {
  if (!q) return {};
  return {
    OR: [
      { slug: { contains: q, mode: "insensitive" } },
      { titleFr: { contains: q, mode: "insensitive" } },
      { titleEn: { contains: q, mode: "insensitive" } },
    ],
  };
}

export async function uniqueMediaGroupSlug(base: string, excludeId?: string): Promise<string> {
  const slug = slugify(base) || "media-group";
  let counter = 0;
  while (true) {
    const candidate = counter === 0 ? slug : `${slug}-${counter}`;
    const existing = await prisma.mediaGroup.findUnique({ where: { slug: candidate } });
    if (!existing || existing.id === excludeId) return candidate;
    counter++;
  }
}

/** Slug base from bilingual titles — prefers FR (same as posts). */
export function slugBaseFromMediaGroupTitles(titleFr: string, titleEn: string): string {
  const base = titleFr.trim() || titleEn.trim();
  return base || "media-group";
}

export async function findPostsReferencingMediaGroup(groupId: string) {
  const token = mediaGroupPlaceholder(groupId);
  return prisma.post.findMany({
    where: {
      OR: [{ bodyFr: { contains: token } }, { bodyEn: { contains: token } }],
    },
    select: {
      id: true,
      slug: true,
      titleFr: true,
      titleEn: true,
      status: true,
    },
    orderBy: { updatedAt: "desc" },
  });
}

export function serializeMediaGroup(
  group: MediaGroupWithMembers,
  referencedByPostIds?: string[]
) {
  return {
    id: group.id,
    slug: group.slug,
    titleFr: group.titleFr,
    titleEn: group.titleEn,
    layout: group.layout,
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
    members: group.members.map((m) => ({
      mediaId: m.mediaId,
      sortOrder: m.sortOrder,
      media: m.media,
    })),
    memberCount: group.members.length,
    referencedByPostIds: referencedByPostIds ?? [],
  };
}

export async function getMediaGroupDetail(id: string) {
  const group = await prisma.mediaGroup.findUnique({
    where: { id },
    include: mediaGroupInclude,
  });
  if (!group) return null;
  const refs = await findPostsReferencingMediaGroup(id);
  return serializeMediaGroup(
    group,
    refs.map((p) => p.id)
  );
}

export async function replaceMediaGroupMembers(groupId: string, mediaIds: string[]) {
  await prisma.$transaction(async (tx) => {
    await tx.mediaGroupMember.deleteMany({ where: { groupId } });
    if (mediaIds.length === 0) return;
    await tx.mediaGroupMember.createMany({
      data: mediaIds.map((mediaId, index) => ({
        groupId,
        mediaId,
        sortOrder: index,
      })),
    });
  });
}

export async function updateMediaGroupSlug(
  groupId: string,
  oldSlug: string,
  newSlug: string
): Promise<string> {
  const slug = await uniqueMediaGroupSlug(newSlug, groupId);
  if (slug === oldSlug) return oldSlug;

  await prisma.$transaction(async (tx) => {
    await tx.mediaGroup.update({ where: { id: groupId }, data: { slug } });
    await tx.mediaGroupSlugHistory.create({
      data: { groupId, oldSlug, newSlug: slug },
    });
  });
  return slug;
}

export async function createMediaGroup(input: {
  titleFr?: string;
  titleEn?: string;
  layout?: MediaGroupLayout;
  mediaIds?: string[];
}) {
  const titleFr = input.titleFr?.trim() ?? "";
  const titleEn = input.titleEn?.trim() ?? "";
  const slug = await uniqueMediaGroupSlug(slugBaseFromMediaGroupTitles(titleFr, titleEn));
  const mediaIds = input.mediaIds ?? [];

  const group = await prisma.mediaGroup.create({
    data: {
      slug,
      titleFr,
      titleEn,
      layout: input.layout ?? MediaGroupLayout.GRID,
      members: mediaIds.length
        ? {
            create: mediaIds.map((mediaId, sortOrder) => ({ mediaId, sortOrder })),
          }
        : undefined,
    },
    include: mediaGroupInclude,
  });

  return serializeMediaGroup(group, []);
}

export const createMediaGroupSchema = z.object({
  titleFr: z.string().optional(),
  titleEn: z.string().optional(),
  layout: z.nativeEnum(MediaGroupLayout).optional(),
  mediaIds: z.array(z.string()).optional(),
});

export const updateMediaGroupSchema = z.object({
  titleFr: z.string().optional(),
  titleEn: z.string().optional(),
  layout: z.nativeEnum(MediaGroupLayout).optional(),
  mediaIds: z.array(z.string()).optional(),
});
