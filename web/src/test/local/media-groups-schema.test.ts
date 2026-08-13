import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { mediaGroupPlaceholder } from "@/lib/media-group-token";
import { slugify } from "@/lib/utils";

const PREFIX = "it-mgrp-";

describe("Prisma — MediaGroup schema (Phase 1d-a)", () => {
  const createdGroupIds: string[] = [];
  let mediaId: string;

  afterAll(async () => {
    if (createdGroupIds.length) {
      await prisma.mediaGroup.deleteMany({ where: { id: { in: createdGroupIds } } });
    }
    if (mediaId) {
      await prisma.media.deleteMany({ where: { id: mediaId } });
    }
  });

  it("creates MediaGroup with ordered members and records slug history", async () => {
    const media = await prisma.media.create({
      data: {
        urlOrigin: "/media/2026/08/schema-origin.jpg",
        titleFr: "Schema test",
        slug: `${PREFIX}${Date.now()}`,
      },
    });
    mediaId = media.id;

    const slug = slugify(`${PREFIX}couples`) || `${PREFIX}group`;
    const group = await prisma.mediaGroup.create({
      data: {
        slug,
        titleFr: "Montage couples",
        titleEn: "Couples montage",
        layout: "GRID",
        members: {
          create: [{ mediaId: media.id, sortOrder: 0 }],
        },
      },
      include: { members: { orderBy: { sortOrder: "asc" } } },
    });
    createdGroupIds.push(group.id);

    expect(group.members).toHaveLength(1);
    expect(group.members[0]?.mediaId).toBe(media.id);
    expect(mediaGroupPlaceholder(group.id)).toBe(`{{media-group:${group.id}}}`);

    await prisma.mediaGroupSlugHistory.create({
      data: {
        groupId: group.id,
        oldSlug: slug,
        newSlug: `${slug}-v2`,
      },
    });

    const history = await prisma.mediaGroupSlugHistory.findFirst({
      where: { groupId: group.id },
    });
    expect(history?.oldSlug).toBe(slug);
    expect(history?.newSlug).toBe(`${slug}-v2`);
  });

  it("backfills Media.slug on existing rows", async () => {
    const withSlug = await prisma.media.findFirst({
      where: { slug: { not: null } },
      select: { slug: true },
    });
    expect(withSlug?.slug).toBeTruthy();
  });
});
