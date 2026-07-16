import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { GalleryFilters, GalleryPhoto } from "@/lib/gallery-types";
import { displayImageUrl } from "@/lib/media-variants";
import { parseHull } from "@/lib/utils";

export type { GalleryFilters, GalleryPhoto } from "@/lib/gallery-types";

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

export async function listGalleryPhotos(
  filters: GalleryFilters = {}
): Promise<GalleryPhoto[]> {
  const search = filters.search?.trim();

  const images = await prisma.postImage.findMany({
    where: {
      post: postFilter(filters),
      ...(search
        ? {
            OR: [
              { titleFr: { contains: search, mode: "insensitive" } },
              { titleEn: { contains: search, mode: "insensitive" } },
              { descriptionFr: { contains: search, mode: "insensitive" } },
              { descriptionEn: { contains: search, mode: "insensitive" } },
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

  const mapped: GalleryPhoto[] = images.map((img) => {
    const display = {
      urlOrigin: img.urlOrigin,
      urlPicto: img.urlPicto,
      urlPetite: img.urlPetite,
      urlMoyenne: img.urlMoyenne,
      urlGrande: img.urlGrande,
    };
    return {
      id: img.id,
      titleFr: img.titleFr,
      titleEn: img.titleEn,
      descriptionFr: img.descriptionFr,
      descriptionEn: img.descriptionEn,
      takenAt: img.takenAt?.toISOString() ?? null,
      sortOrder: img.sortOrder,
      urlOrigin: img.urlOrigin,
      urlPicto: img.urlPicto,
      urlPetite: img.urlPetite,
      urlMoyenne: img.urlMoyenne,
      urlGrande: img.urlGrande,
      thumbUrl: img.urlPetite || img.urlPicto || displayImageUrl(display),
      displayUrl: displayImageUrl(display),
      focusX: img.focusX,
      focusY: img.focusY,
      zoom: img.zoom,
      rotation: img.rotation,
      cropX: img.cropX,
      cropY: img.cropY,
      cropW: img.cropW,
      cropH: img.cropH,
      post: {
        id: img.post.id,
        slug: img.post.slug,
        titleFr: img.post.titleFr,
        titleEn: img.post.titleEn,
        publishedAt: img.post.publishedAt?.toISOString() ?? null,
      },
      milestones: img.post.milestones.map((m) => ({
        slug: m.milestone.slug,
        titleFr: m.milestone.titleFr,
        titleEn: m.milestone.titleEn,
        milestoneDate: m.milestone.milestoneDate.toISOString(),
      })),
      themes: img.post.themes.map((t) => ({
        slug: t.theme.slug,
        labelFr: t.theme.labelFr,
        labelEn: t.theme.labelEn,
      })),
      tags: img.post.tags.map((t) => ({
        name: t.tag.name,
        labelFr: t.tag.labelFr,
        labelEn: t.tag.labelEn,
      })),
      hulls: img.post.hulls.map((h) => h.hull),
    };
  });

  const sort = filters.sort === "milestone" ? "milestone" : "date";

  mapped.sort((a, b) => {
    if (sort === "milestone") {
      const aDate = a.milestones[0]?.milestoneDate ?? a.takenAt ?? a.post.publishedAt ?? "";
      const bDate = b.milestones[0]?.milestoneDate ?? b.takenAt ?? b.post.publishedAt ?? "";
      if (aDate !== bDate) return bDate.localeCompare(aDate);
    } else {
      const aDate = a.takenAt ?? a.post.publishedAt ?? "";
      const bDate = b.takenAt ?? b.post.publishedAt ?? "";
      if (aDate !== bDate) return bDate.localeCompare(aDate);
    }
    return a.sortOrder - b.sortOrder;
  });

  return mapped;
}
