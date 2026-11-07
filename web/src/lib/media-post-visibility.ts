import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { parseMediaGroupIds } from "@/lib/media-group-token";

/** Unique MediaGroup ids referenced in post bodyFr/bodyEn (document order). */
export function collectMediaGroupIdsFromBodies(
  bodies: Array<{ bodyFr?: string | null; bodyEn?: string | null }>
): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const body of bodies) {
    for (const id of [
      ...parseMediaGroupIds(body.bodyFr ?? ""),
      ...parseMediaGroupIds(body.bodyEn ?? ""),
    ]) {
      if (!seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
  }
  return ids;
}

/** Unique group ids referenced by posts matching `where` (default: all posts). */
export async function collectGroupIdsReferencedByPosts(
  where?: Prisma.PostWhereInput
): Promise<string[]> {
  const posts = await prisma.post.findMany({
    where: where ?? {},
    select: { bodyFr: true, bodyEn: true },
  });
  return collectMediaGroupIdsFromBodies(posts);
}

/** Load group-id sets for any body reference vs published-only (one DB round-trip). */
export async function loadReferencedGroupIdSets(): Promise<{
  any: string[];
  published: string[];
}> {
  const posts = await prisma.post.findMany({
    select: { status: true, bodyFr: true, bodyEn: true },
  });
  return {
    any: collectMediaGroupIdsFromBodies(posts),
    published: collectMediaGroupIdsFromBodies(
      posts.filter((p) => p.status === "PUBLISHED")
    ),
  };
}

/** Media linked via PostMedia on a PUBLISHED post OR member of a body-referenced published group. */
export function mediaPublicOnBlogClause(
  publishedGroupIds: string[]
): Prisma.MediaWhereInput {
  const or: Prisma.MediaWhereInput[] = [
    { posts: { some: { post: { status: "PUBLISHED" } } } },
  ];
  if (publishedGroupIds.length > 0) {
    or.push({
      groupMembers: { some: { groupId: { in: publishedGroupIds } } },
    });
  }
  return { OR: or };
}

/** Media has any article link: PostMedia row and/or membership in a body-referenced group. */
export function mediaLinkedToArticlesClause(
  referencedGroupIds: string[]
): Prisma.MediaWhereInput {
  const or: Prisma.MediaWhereInput[] = [{ posts: { some: {} } }];
  if (referencedGroupIds.length > 0) {
    or.push({
      groupMembers: { some: { groupId: { in: referencedGroupIds } } },
    });
  }
  return { OR: or };
}

/**
 * Orphan = no PostMedia AND not a member of any group inserted in any post body.
 * Group membership alone (never inserted) remains orphan.
 */
export function mediaOrphanClause(
  referencedGroupIds: string[]
): Prisma.MediaWhereInput {
  const and: Prisma.MediaWhereInput[] = [{ posts: { none: {} } }];
  if (referencedGroupIds.length > 0) {
    and.push({
      groupMembers: { none: { groupId: { in: referencedGroupIds } } },
    });
  }
  return { AND: and };
}

/** Draft = linked to an article somehow, but not public on the blog. */
export function mediaDraftOnBlogClause(
  anyGroupIds: string[],
  publishedGroupIds: string[]
): Prisma.MediaWhereInput {
  return {
    AND: [
      mediaLinkedToArticlesClause(anyGroupIds),
      { NOT: mediaPublicOnBlogClause(publishedGroupIds) },
    ],
  };
}
