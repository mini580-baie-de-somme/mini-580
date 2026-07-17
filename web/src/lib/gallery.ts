import "server-only";

import { MediaKind, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { GalleryFilters, GalleryItem } from "@/lib/gallery-types";
import { displayImageUrl } from "@/lib/media-variants";
import { parseHull } from "@/lib/utils";

export type { GalleryFilters, GalleryItem, GalleryPhoto } from "@/lib/gallery-types";

function postFilter(filters: GalleryFilters): Prisma.PostWhereInput {
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
    where.milestones = { some: { milestone: { slug: filters.milestone } } };
  }

  return where;
}

export async function listGalleryItems(
  filters: GalleryFilters = {}
): Promise<GalleryItem[]> {
  const search = filters.search?.trim();
  const kind =
    filters.kind && filters.kind !== "ALL"
      ? (filters.kind as MediaKind)
      : undefined;

  const links = await prisma.postMedia.findMany({
    where: {
      post: postFilter(filters),
      ...(kind ? { media: { kind } } : {}),
      ...(search
        ? {
            OR: [
              { media: { titleFr: { contains: search, mode: "insensitive" } } },
              { media: { titleEn: { contains: search, mode: "insensitive" } } },
              {
                media: {
                  descriptionFr: { contains: search, mode: "insensitive" },
                },
              },
              {
                media: {
                  descriptionEn: { contains: search, mode: "insensitive" },
                },
              },
              {
                post: {
                  OR: [
                    { titleFr: { contains: search, mode: "insensitive" } },
                    { titleEn: { contains: search, mode: "insensitive" } },
                  ],
                },
              },
            ],
          }
        : {}),
    },
    include: {
      media: true,
      post: {
        include: {
          hulls: true,
          tags: { include: { tag: true } },
          themes: { include: { theme: true } },
          milestones: { include: { milestone: true } },
        },
      },
    },
  });

  // Dedupe media appearing on multiple published posts
  const byMedia = new Map<string, (typeof links)[number][]>();
  for (const link of links) {
    const list = byMedia.get(link.mediaId) ?? [];
    list.push(link);
    byMedia.set(link.mediaId, list);
  }

  const items: GalleryItem[] = [];
  for (const group of byMedia.values()) {
    const primary = group[0]!;
    const media = primary.media;
    const display = {
      urlOrigin: media.urlOrigin,
      urlPicto: media.urlPicto,
      urlPetite: media.urlPetite,
      urlMoyenne: media.urlMoyenne,
      urlGrande: media.urlGrande,
    };
    const thumbUrl =
      media.kind === "IMAGE"
        ? media.urlPetite || media.urlPicto || media.urlOrigin
        : media.urlOrigin;
    const displayUrl =
      media.kind === "IMAGE" ? displayImageUrl(display) : media.urlOrigin;

    const milestones = group.flatMap((g) =>
      g.post.milestones.map((m) => ({
        slug: m.milestone.slug,
        titleFr: m.milestone.titleFr,
        titleEn: m.milestone.titleEn,
        milestoneDate: m.milestone.milestoneDate.toISOString(),
      }))
    );
    const themes = group.flatMap((g) =>
      g.post.themes.map((t) => ({
        slug: t.theme.slug,
        labelFr: t.theme.labelFr,
        labelEn: t.theme.labelEn,
      }))
    );
    const tags = group.flatMap((g) =>
      g.post.tags.map((t) => ({
        name: t.tag.name,
        labelFr: t.tag.labelFr,
        labelEn: t.tag.labelEn,
      }))
    );
    const hulls = [
      ...new Set(group.flatMap((g) => g.post.hulls.map((h) => h.hull))),
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
      sortOrder: primary.sortOrder,
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
        id: primary.post.id,
        slug: primary.post.slug,
        titleFr: primary.post.titleFr,
        titleEn: primary.post.titleEn,
        publishedAt: primary.post.publishedAt?.toISOString() ?? null,
      },
      posts: group.map((g) => ({
        id: g.post.id,
        slug: g.post.slug,
        titleFr: g.post.titleFr,
        titleEn: g.post.titleEn,
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
