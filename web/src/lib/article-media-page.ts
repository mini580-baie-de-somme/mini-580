import "server-only";

import { prisma } from "@/lib/db";
import {
  buildArticleMediaManifest,
  type ArticleMediaManifestInput,
} from "@/lib/article-media-manifest";
import type { ArticleMediaPageData, PublicMediaGroup } from "@/lib/article-media-types";
import { mediaAsPostImage } from "@/lib/media-library";
import { parseMediaGroupIds } from "@/lib/media-group-token";

export type { ArticleMediaPageData, PublicMediaGroup } from "@/lib/article-media-types";

function buildGroupIndexMap(
  items: Awaited<ReturnType<typeof buildArticleMediaManifest>>
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const item of items) {
    if (item.groupId && map[item.groupId] === undefined) {
      map[item.groupId] = item.manifestIndex;
    }
  }
  return map;
}

/** Resolve inline groups + unified manifests for public article / preview pages. */
export async function prepareArticleMediaPageData(
  post: ArticleMediaManifestInput
): Promise<ArticleMediaPageData> {
  const groupIds = [
    ...new Set([
      ...parseMediaGroupIds(post.bodyFr),
      ...parseMediaGroupIds(post.bodyEn),
    ]),
  ];

  const groups =
    groupIds.length > 0
      ? await prisma.mediaGroup.findMany({
          where: { id: { in: groupIds } },
          include: {
            members: {
              orderBy: { sortOrder: "asc" },
              include: { media: true },
            },
          },
        })
      : [];

  const manifestFr = await buildArticleMediaManifest(post, "fr");
  const manifestEn = await buildArticleMediaManifest(post, "en");

  const mediaGroups: Record<string, PublicMediaGroup> = {};
  for (const group of groups) {
    mediaGroups[group.id] = {
      id: group.id,
      titleFr: group.titleFr,
      titleEn: group.titleEn,
      layout: group.layout,
      members: group.members.map((member) =>
        mediaAsPostImage(member.media, {
          sortOrder: member.sortOrder,
          isCover: false,
          postId: post.id,
        })
      ),
    };
  }

  return {
    manifestFr: manifestFr.map((item) => item.media),
    manifestEn: manifestEn.map((item) => item.media),
    manifestIndexByGroupIdFr: buildGroupIndexMap(manifestFr),
    manifestIndexByGroupIdEn: buildGroupIndexMap(manifestEn),
    mediaGroups,
  };
}
