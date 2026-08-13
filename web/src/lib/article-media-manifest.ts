import "server-only";

import type { Media, PostMedia } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { parseMediaGroupIds } from "@/lib/media-group-token";
import { mediaAsPostImage } from "@/lib/media-library";

export type MediaManifestSource = "cover" | "inline-group" | "standalone";

export type MediaManifestItem = {
  mediaId: string;
  source: MediaManifestSource;
  groupId?: string;
  manifestIndex: number;
  media: ReturnType<typeof mediaAsPostImage>;
};

export type ArticleMediaManifestInput = {
  id: string;
  coverImageUrl: string | null;
  bodyFr: string;
  bodyEn: string;
  mediaLinks: Array<
    PostMedia & {
      media: Media;
    }
  >;
};

function resolveCoverMediaId(
  mediaLinks: ArticleMediaManifestInput["mediaLinks"],
  coverImageUrl: string | null
): string | null {
  const coverLink = mediaLinks.find((l) => l.isCover);
  if (coverLink) return coverLink.mediaId;

  if (!coverImageUrl) return null;

  const byUrl = mediaLinks.find(
    (l) =>
      l.media.urlOrigin === coverImageUrl ||
      l.media.urlGrande === coverImageUrl ||
      l.media.urlMoyenne === coverImageUrl ||
      l.media.urlPetite === coverImageUrl ||
      l.media.urlPicto === coverImageUrl
  );
  if (byUrl) return byUrl.mediaId;

  return null;
}

function mediaLinkById(
  mediaLinks: ArticleMediaManifestInput["mediaLinks"],
  mediaId: string
) {
  return mediaLinks.find((l) => l.mediaId === mediaId);
}

/** Build ordered, deduplicated media manifest for an article (spec § Manifeste unifié). */
export async function buildArticleMediaManifest(
  post: ArticleMediaManifestInput,
  locale: "fr" | "en"
): Promise<MediaManifestItem[]> {
  const body = locale === "en" ? post.bodyEn : post.bodyFr;
  const groupIds = parseMediaGroupIds(body);

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

  const groupById = new Map(groups.map((g) => [g.id, g]));
  const seen = new Set<string>();
  const items: MediaManifestItem[] = [];

  const append = (
    media: Media,
    source: MediaManifestSource,
    link: { sortOrder: number; isCover: boolean; postId?: string },
    groupId?: string
  ) => {
    if (seen.has(media.id)) return;
    seen.add(media.id);
    items.push({
      mediaId: media.id,
      source,
      groupId,
      manifestIndex: items.length,
      media: mediaAsPostImage(media, { ...link, postId: post.id }),
    });
  };

  const coverMediaId = resolveCoverMediaId(post.mediaLinks, post.coverImageUrl);
  if (coverMediaId) {
    const link = mediaLinkById(post.mediaLinks, coverMediaId);
    const media =
      link?.media ??
      (await prisma.media.findUnique({ where: { id: coverMediaId } }));
    if (media) {
      append(media, "cover", link ?? { sortOrder: 0, isCover: true, postId: post.id });
    }
  }

  for (const groupId of groupIds) {
    const group = groupById.get(groupId);
    if (!group) continue;
    for (const member of group.members) {
      const link = mediaLinkById(post.mediaLinks, member.mediaId);
      append(
        member.media,
        "inline-group",
        link ?? { sortOrder: member.sortOrder, isCover: false, postId: post.id },
        groupId
      );
    }
  }

  const standaloneLinks = [...post.mediaLinks]
    .filter((l) => !l.isCover)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  for (const link of standaloneLinks) {
    append(link.media, "standalone", link);
  }

  return items;
}

export function serializeMediaManifestResponse(items: MediaManifestItem[]) {
  return {
    items,
    total: items.length,
  };
}
