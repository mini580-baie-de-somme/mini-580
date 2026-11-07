import "server-only";

import { MediaKind, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { GalleryFilters, GalleryItem } from "@/lib/gallery-types";
import {
  milestonesForPostPublishedAt,
  publishedAtRangeForMilestone,
} from "@/lib/milestone-windows";
import { displayImageUrl } from "@/lib/media-variants";
import { collectMediaGroupIdsFromBodies } from "@/lib/media-post-visibility";
import { parseMediaGroupIds } from "@/lib/media-group-token";
import { parseHull } from "@/lib/utils";

export type { GalleryFilters, GalleryItem, GalleryPhoto } from "@/lib/gallery-types";

async function postFilter(filters: GalleryFilters): Promise<Prisma.PostWhereInput> {
  const where: Prisma.PostWhereInput = { status: "PUBLISHED" };

  if (filters.hull) {
    const hull = parseHull(filters.hull);
    if (hull) where.hulls = { some: { hull } };
  }
  if (filters.theme) {
    where.themes = { some: { theme: { slug: filters.theme } } };
  }
  if (filters.tag) {
    where.tags = { some: { tag: { name: filters.tag } } };
  }
  if (filters.milestone) {
    const m = await prisma.milestone.findUnique({
      where: { slug: filters.milestone },
      select: { milestoneDate: true, endDate: true },
    });
    if (m) {
      Object.assign(where, publishedAtRangeForMilestone(m));
    } else {
      where.id = "__none__";
    }
  }

  return where;
}

type GalleryPostRow = Prisma.PostGetPayload<{
  include: {
    mediaLinks: { include: { media: true } };
    hulls: true;
    tags: { include: { tag: true } };
    themes: { include: { theme: true } };
  };
}>;

type GalleryMediaRow = GalleryPostRow["mediaLinks"][number]["media"];

type AccEntry = {
  media: GalleryMediaRow;
  posts: GalleryPostRow[];
  sortOrder: number;
};

function mediaMatchesSearch(
  media: GalleryMediaRow,
  post: GalleryPostRow,
  search: string
): boolean {
  const q = search.toLowerCase();
  const fields = [
    media.titleFr,
    media.titleEn,
    media.descriptionFr,
    media.descriptionEn,
    post.titleFr,
    post.titleEn,
  ];
  return fields.some((f) => f.toLowerCase().includes(q));
}

function acceptMedia(
  media: GalleryMediaRow,
  post: GalleryPostRow,
  kind: MediaKind | undefined,
  search: string | undefined
): boolean {
  if (kind && media.kind !== kind) return false;
  if (search && !mediaMatchesSearch(media, post, search)) return false;
  return true;
}

function addMediaToAcc(
  byMedia: Map<string, AccEntry>,
  media: GalleryMediaRow,
  post: GalleryPostRow,
  sortOrder: number
) {
  const existing = byMedia.get(media.id);
  if (existing) {
    if (!existing.posts.some((p) => p.id === post.id)) {
      existing.posts.push(post);
    }
    return;
  }
  byMedia.set(media.id, { media, posts: [post], sortOrder });
}

export async function listGalleryItems(
  filters: GalleryFilters = {}
): Promise<GalleryItem[]> {
  const search = filters.search?.trim();
  const kind =
    filters.kind && filters.kind !== "ALL"
      ? (filters.kind as MediaKind)
      : undefined;

  const postWhere = await postFilter(filters);

  const [posts, allMilestones] = await Promise.all([
    prisma.post.findMany({
      where: postWhere,
      include: {
        mediaLinks: { include: { media: true } },
        hulls: true,
        tags: { include: { tag: true } },
        themes: { include: { theme: true } },
      },
    }),
    prisma.milestone.findMany({
      select: {
        id: true,
        slug: true,
        titleFr: true,
        titleEn: true,
        milestoneDate: true,
        endDate: true,
      },
    }),
  ]);

  const groupIds = collectMediaGroupIdsFromBodies(posts);
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

  const byMedia = new Map<string, AccEntry>();

  for (const post of posts) {
    for (const link of post.mediaLinks) {
      if (!acceptMedia(link.media, post, kind, search)) continue;
      addMediaToAcc(byMedia, link.media, post, link.sortOrder);
    }

    const referenced = [
      ...new Set([
        ...parseMediaGroupIds(post.bodyFr),
        ...parseMediaGroupIds(post.bodyEn),
      ]),
    ];
    for (const groupId of referenced) {
      const group = groupById.get(groupId);
      if (!group) continue;
      for (const member of group.members) {
        if (!acceptMedia(member.media, post, kind, search)) continue;
        addMediaToAcc(byMedia, member.media, post, member.sortOrder);
      }
    }
  }

  const items: GalleryItem[] = [];
  for (const entry of byMedia.values()) {
    const media = entry.media;
    const primary = entry.posts[0]!;
    const display = {
      urlOrigin: media.urlOrigin,
      urlPicto: media.urlPicto,
      urlPetite: media.urlPetite,
      urlMoyenne: media.urlMoyenne,
      urlGrande: media.urlGrande,
    };
    // Never expose a PDF/video URL as thumbUrl — browsers show a broken <img>.
    const thumbUrl =
      media.kind === "IMAGE"
        ? media.urlPetite || media.urlPicto || media.urlOrigin
        : "";
    const displayUrl =
      media.kind === "IMAGE" ? displayImageUrl(display) : media.urlOrigin;

    const milestones = entry.posts.flatMap((p) =>
      milestonesForPostPublishedAt(p, allMilestones).map((m) => ({
        slug: m.slug,
        titleFr: m.titleFr,
        titleEn: m.titleEn,
        milestoneDate: m.milestoneDate.toISOString(),
      }))
    );
    const themes = entry.posts.flatMap((p) =>
      p.themes.map((t) => ({
        slug: t.theme.slug,
        labelFr: t.theme.labelFr,
        labelEn: t.theme.labelEn,
      }))
    );
    const tags = entry.posts.flatMap((p) =>
      p.tags.map((t) => ({
        name: t.tag.name,
        labelFr: t.tag.labelFr,
        labelEn: t.tag.labelEn,
      }))
    );
    const hulls = [
      ...new Set(entry.posts.flatMap((p) => p.hulls.map((h) => h.hull))),
    ];

    items.push({
      id: media.id,
      kind: media.kind,
      mimeType: media.mimeType,
      titleFr: media.titleFr,
      titleEn: media.titleEn,
      descriptionFr: media.descriptionFr,
      descriptionEn: media.descriptionEn,
      takenAt: media.takenAt?.toISOString() ?? null,
      sortOrder: entry.sortOrder,
      urlOrigin: media.urlOrigin,
      urlPicto: media.urlPicto,
      urlPetite: media.urlPetite,
      urlMoyenne: media.urlMoyenne,
      urlGrande: media.urlGrande,
      thumbUrl,
      displayUrl,
      focusX: media.focusX,
      focusY: media.focusY,
      zoom: media.zoom,
      rotation: media.rotation,
      cropX: media.cropX,
      cropY: media.cropY,
      cropW: media.cropW,
      cropH: media.cropH,
      post: {
        id: primary.id,
        slug: primary.slug,
        titleFr: primary.titleFr,
        titleEn: primary.titleEn,
        publishedAt: primary.publishedAt?.toISOString() ?? null,
      },
      posts: entry.posts.map((p) => ({
        id: p.id,
        slug: p.slug,
        titleFr: p.titleFr,
        titleEn: p.titleEn,
      })),
      milestones,
      themes,
      tags,
      hulls,
    });
  }

  if (filters.sort === "milestone") {
    items.sort((a, b) => {
      const da = a.milestones[0]?.milestoneDate ?? "";
      const db = b.milestones[0]?.milestoneDate ?? "";
      return da.localeCompare(db);
    });
  } else {
    items.sort((a, b) => {
      const da = a.takenAt ?? a.post.publishedAt ?? "";
      const db = b.takenAt ?? b.post.publishedAt ?? "";
      return db.localeCompare(da);
    });
  }

  return items;
}

/** @deprecated use listGalleryItems */
export const listGalleryPhotos = listGalleryItems;
