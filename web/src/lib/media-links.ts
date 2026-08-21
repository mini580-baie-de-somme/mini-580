import type { MediaWithPosts } from "@/lib/media-library";

/** Cover/header link — PostMedia with isCover=true (valid media→article link). */
export type MediaCoverLink = {
  postId: string;
  titleFr: string;
  titleEn: string;
  slug: string;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
};

/** Media group membership — valid media→article body link (via inline group). */
export type MediaGroupLink = {
  groupId: string;
  titleFr: string;
  titleEn: string;
  slug: string;
};

/** Structured link info for delete confirm UI and API responses. */
export type MediaLinkInfo = {
  coverLinks: MediaCoverLink[];
  groups: MediaGroupLink[];
  /** Legacy PostMedia rows (isCover=false) — purged on delete, not blocking. */
  legacyPostLinkCount: number;
};

export function extractMediaLinkInfo(
  media: Pick<MediaWithPosts, "posts" | "groupMembers">
): MediaLinkInfo {
  const coverLinks: MediaCoverLink[] = [];
  let legacyPostLinkCount = 0;

  for (const link of media.posts ?? []) {
    if (link.isCover) {
      coverLinks.push({
        postId: link.post.id,
        titleFr: link.post.titleFr,
        titleEn: link.post.titleEn,
        slug: link.post.slug,
        status: link.post.status,
      });
    } else {
      legacyPostLinkCount += 1;
    }
  }

  const groups: MediaGroupLink[] = (media.groupMembers ?? []).map((gm) => ({
    groupId: gm.group.id,
    titleFr: gm.group.titleFr,
    titleEn: gm.group.titleEn,
    slug: gm.group.slug,
  }));

  return { coverLinks, groups, legacyPostLinkCount };
}

/** Links that require force=1 or user confirmation before delete. */
export function hasBlockingMediaLinks(info: MediaLinkInfo): boolean {
  return info.coverLinks.length > 0 || info.groups.length > 0;
}

export function mediaLinkLabel(
  item: { titleFr: string; titleEn: string; slug: string },
  locale: "fr" | "en"
): string {
  const title = locale === "fr" ? item.titleFr : item.titleEn;
  return title.trim() || item.slug;
}
