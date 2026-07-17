import "server-only";

import { Hull, PostStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { postInclude, type PostWithRelations } from "@/lib/posts";

export type SyncCatalogPayload = {
  tags: { id: string; name: string; labelFr: string; labelEn: string; createdAt: string }[];
  themes: { id: string; slug: string; labelFr: string; labelEn: string }[];
  milestones: {
    id: string;
    slug: string;
    titleFr: string;
    titleEn: string;
    descriptionFr: string;
    descriptionEn: string;
    milestoneDate: string;
    sortOrder: number;
    createdAt: string;
  }[];
};

export type SyncPostPayload = {
  id: string;
  slug: string;
  titleFr: string;
  titleEn: string;
  excerptFr: string;
  excerptEn: string;
  bodyFr: string;
  bodyEn: string;
  status: PostStatus;
  coverImageUrl: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  authorEmail: string;
  hulls: Hull[];
  tags: { id: string; name: string; labelFr: string; labelEn: string }[];
  themes: { id: string; slug: string; labelFr: string; labelEn: string }[];
  milestones: {
    id: string;
    slug: string;
    titleFr: string;
    titleEn: string;
    descriptionFr: string;
    descriptionEn: string;
    milestoneDate: string;
    sortOrder: number;
  }[];
  images: {
    id: string;
    urlOrigin: string;
    urlPicto: string | null;
    urlPetite: string | null;
    urlMoyenne: string | null;
    urlGrande: string | null;
    titleFr: string;
    titleEn: string;
    descriptionFr: string;
    descriptionEn: string;
    takenAt: string | null;
    sortOrder: number;
    focusX: number;
    focusY: number;
    zoom: number;
    rotation: number;
    cropX: number;
    cropY: number;
    cropW: number;
    cropH: number;
  }[];
};

export type SyncPostSummary = {
  id: string;
  slug: string;
  titleFr: string;
  titleEn: string;
  status: PostStatus;
  updatedAt: string;
  publishedAt: string | null;
};

function serializePost(post: PostWithRelations): SyncPostPayload {
  return {
    id: post.id,
    slug: post.slug,
    titleFr: post.titleFr,
    titleEn: post.titleEn,
    excerptFr: post.excerptFr,
    excerptEn: post.excerptEn,
    bodyFr: post.bodyFr,
    bodyEn: post.bodyEn,
    status: post.status,
    coverImageUrl: post.coverImageUrl,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    authorEmail: post.author.email,
    hulls: post.hulls.map((h) => h.hull),
    tags: post.tags.map((t) => ({
      id: t.tag.id,
      name: t.tag.name,
      labelFr: t.tag.labelFr,
      labelEn: t.tag.labelEn,
    })),
    themes: post.themes.map((t) => ({
      id: t.theme.id,
      slug: t.theme.slug,
      labelFr: t.theme.labelFr,
      labelEn: t.theme.labelEn,
    })),
    milestones: post.milestones.map((m) => ({
      id: m.milestone.id,
      slug: m.milestone.slug,
      titleFr: m.milestone.titleFr,
      titleEn: m.milestone.titleEn,
      descriptionFr: m.milestone.descriptionFr,
      descriptionEn: m.milestone.descriptionEn,
      milestoneDate: m.milestone.milestoneDate.toISOString(),
      sortOrder: m.milestone.sortOrder,
    })),
    images: post.mediaLinks.map((link) => ({
      id: link.media.id,
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
      takenAt: link.media.takenAt?.toISOString() ?? null,
      sortOrder: link.sortOrder,
      isCover: link.isCover,
      focusX: link.media.focusX,
      focusY: link.media.focusY,
      zoom: link.media.zoom,
      rotation: link.media.rotation,
      cropX: link.media.cropX,
      cropY: link.media.cropY,
      cropW: link.media.cropW,
      cropH: link.media.cropH,
    })),
  };
}

export async function exportCatalog(): Promise<SyncCatalogPayload> {
  const [tags, themes, milestones] = await Promise.all([
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
    prisma.theme.findMany({ orderBy: { slug: "asc" } }),
    prisma.milestone.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  return {
    tags: tags.map((t) => ({
      id: t.id,
      name: t.name,
      labelFr: t.labelFr,
      labelEn: t.labelEn,
      createdAt: t.createdAt.toISOString(),
    })),
    themes: themes.map((t) => ({
      id: t.id,
      slug: t.slug,
      labelFr: t.labelFr,
      labelEn: t.labelEn,
    })),
    milestones: milestones.map((m) => ({
      id: m.id,
      slug: m.slug,
      titleFr: m.titleFr,
      titleEn: m.titleEn,
      descriptionFr: m.descriptionFr,
      descriptionEn: m.descriptionEn,
      milestoneDate: m.milestoneDate.toISOString(),
      sortOrder: m.sortOrder,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

export async function exportPosts(): Promise<SyncPostPayload[]> {
  const posts = await prisma.post.findMany({
    where: { status: { not: PostStatus.ARCHIVED } },
    include: postInclude,
    orderBy: { updatedAt: "desc" },
  });
  return posts.map(serializePost);
}

export async function exportPostSummaries(): Promise<SyncPostSummary[]> {
  const posts = await prisma.post.findMany({
    where: { status: { not: PostStatus.ARCHIVED } },
    select: {
      id: true,
      slug: true,
      titleFr: true,
      titleEn: true,
      status: true,
      updatedAt: true,
      publishedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });
  return posts.map((p) => ({
    id: p.id,
    slug: p.slug,
    titleFr: p.titleFr,
    titleEn: p.titleEn,
    status: p.status,
    updatedAt: p.updatedAt.toISOString(),
    publishedAt: p.publishedAt?.toISOString() ?? null,
  }));
}

export async function exportPostById(id: string): Promise<SyncPostPayload | null> {
  const post = await prisma.post.findUnique({
    where: { id },
    include: postInclude,
  });
  if (!post || post.status === PostStatus.ARCHIVED) return null;
  return serializePost(post);
}

async function ensureAuthor(email: string): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing.id;

  const fallback =
    (await prisma.user.findFirst({ orderBy: { createdAt: "asc" } })) ??
    (await prisma.user.create({
      data: {
        email: process.env.SEED_ADMIN_EMAIL ?? "admin@classmini580.blog",
        name: "Admin Class Mini 5.80",
        passwordHash: "!", // unusable; sync-imported author placeholder
      },
    }));

  // Prefer mapping foreign author to local admin rather than creating orphans
  return fallback.id;
}

async function resolveSlugConflict(slug: string, keepId: string) {
  const clash = await prisma.post.findUnique({ where: { slug } });
  if (clash && clash.id !== keepId) {
    await prisma.post.update({
      where: { id: clash.id },
      data: { slug: `${clash.slug}-local-${clash.id.slice(-6)}` },
    });
  }
}

export async function upsertCatalog(payload: SyncCatalogPayload) {
  for (const tag of payload.tags) {
    const nameClash = await prisma.tag.findUnique({ where: { name: tag.name } });
    if (nameClash && nameClash.id !== tag.id) {
      await prisma.tag.update({
        where: { id: nameClash.id },
        data: { name: `${nameClash.name}-local-${nameClash.id.slice(-6)}` },
      });
    }
    await prisma.tag.upsert({
      where: { id: tag.id },
      create: {
        id: tag.id,
        name: tag.name,
        labelFr: tag.labelFr,
        labelEn: tag.labelEn,
        createdAt: new Date(tag.createdAt),
      },
      update: {
        name: tag.name,
        labelFr: tag.labelFr,
        labelEn: tag.labelEn,
      },
    });
  }

  for (const theme of payload.themes) {
    const slugClash = await prisma.theme.findUnique({ where: { slug: theme.slug } });
    if (slugClash && slugClash.id !== theme.id) {
      await prisma.theme.update({
        where: { id: slugClash.id },
        data: { slug: `${slugClash.slug}-local-${slugClash.id.slice(-6)}` },
      });
    }
    await prisma.theme.upsert({
      where: { id: theme.id },
      create: {
        id: theme.id,
        slug: theme.slug,
        labelFr: theme.labelFr,
        labelEn: theme.labelEn,
      },
      update: {
        slug: theme.slug,
        labelFr: theme.labelFr,
        labelEn: theme.labelEn,
      },
    });
  }

  for (const m of payload.milestones) {
    const slugClash = await prisma.milestone.findUnique({ where: { slug: m.slug } });
    if (slugClash && slugClash.id !== m.id) {
      await prisma.milestone.update({
        where: { id: slugClash.id },
        data: { slug: `${slugClash.slug}-local-${slugClash.id.slice(-6)}` },
      });
    }
    await prisma.milestone.upsert({
      where: { id: m.id },
      create: {
        id: m.id,
        slug: m.slug,
        titleFr: m.titleFr,
        titleEn: m.titleEn,
        descriptionFr: m.descriptionFr,
        descriptionEn: m.descriptionEn,
        milestoneDate: new Date(m.milestoneDate),
        sortOrder: m.sortOrder,
        createdAt: new Date(m.createdAt),
      },
      update: {
        slug: m.slug,
        titleFr: m.titleFr,
        titleEn: m.titleEn,
        descriptionFr: m.descriptionFr,
        descriptionEn: m.descriptionEn,
        milestoneDate: new Date(m.milestoneDate),
        sortOrder: m.sortOrder,
      },
    });
  }
}

/** Full overwrite of a post by id (PROD → TEST or publish TEST → PROD). */
export async function upsertPostFromSync(payload: SyncPostPayload) {
  // Ensure related catalog entities exist (by id)
  await upsertCatalog({
    tags: payload.tags.map((t) => ({
      ...t,
      createdAt: new Date().toISOString(),
    })),
    themes: payload.themes,
    milestones: payload.milestones.map((m) => ({
      ...m,
      createdAt: new Date().toISOString(),
    })),
  });

  const authorId = await ensureAuthor(payload.authorEmail);
  await resolveSlugConflict(payload.slug, payload.id);

  await prisma.post.upsert({
    where: { id: payload.id },
    create: {
      id: payload.id,
      slug: payload.slug,
      titleFr: payload.titleFr,
      titleEn: payload.titleEn,
      excerptFr: payload.excerptFr,
      excerptEn: payload.excerptEn,
      bodyFr: payload.bodyFr,
      bodyEn: payload.bodyEn,
      status: payload.status,
      coverImageUrl: payload.coverImageUrl,
      publishedAt: payload.publishedAt ? new Date(payload.publishedAt) : null,
      createdAt: new Date(payload.createdAt),
      updatedAt: new Date(payload.updatedAt),
      authorId,
    },
    update: {
      slug: payload.slug,
      titleFr: payload.titleFr,
      titleEn: payload.titleEn,
      excerptFr: payload.excerptFr,
      excerptEn: payload.excerptEn,
      bodyFr: payload.bodyFr,
      bodyEn: payload.bodyEn,
      status: payload.status,
      coverImageUrl: payload.coverImageUrl,
      publishedAt: payload.publishedAt ? new Date(payload.publishedAt) : null,
      updatedAt: new Date(payload.updatedAt),
      authorId,
    },
  });

  await prisma.postHull.deleteMany({ where: { postId: payload.id } });
  if (payload.hulls.length) {
    await prisma.postHull.createMany({
      data: payload.hulls.map((hull) => ({ postId: payload.id, hull })),
    });
  }

  await prisma.postTag.deleteMany({ where: { postId: payload.id } });
  if (payload.tags.length) {
    await prisma.postTag.createMany({
      data: payload.tags.map((t) => ({ postId: payload.id, tagId: t.id })),
    });
  }

  await prisma.postTheme.deleteMany({ where: { postId: payload.id } });
  if (payload.themes.length) {
    await prisma.postTheme.createMany({
      data: payload.themes.map((t) => ({ postId: payload.id, themeId: t.id })),
    });
  }

  await prisma.postMilestone.deleteMany({ where: { postId: payload.id } });
  if (payload.milestones.length) {
    await prisma.postMilestone.createMany({
      data: payload.milestones.map((m) => ({
        postId: payload.id,
        milestoneId: m.id,
      })),
    });
  }

  // Sync media: upsert Media rows, then replace this post's links only
  await prisma.postMedia.deleteMany({ where: { postId: payload.id } });
  for (const img of payload.images) {
    await prisma.media.upsert({
      where: { id: img.id },
      create: {
        id: img.id,
        kind: "IMAGE",
        mimeType: "image/jpeg",
        urlOrigin: img.urlOrigin,
        urlPicto: img.urlPicto,
        urlPetite: img.urlPetite,
        urlMoyenne: img.urlMoyenne ?? img.urlOrigin,
        urlGrande: img.urlGrande,
        titleFr: img.titleFr ?? "",
        titleEn: img.titleEn ?? "",
        descriptionFr: img.descriptionFr,
        descriptionEn: img.descriptionEn,
        takenAt: img.takenAt ? new Date(img.takenAt) : null,
        focusX: img.focusX ?? 0.5,
        focusY: img.focusY ?? 0.5,
        zoom: img.zoom ?? 1,
        rotation: img.rotation ?? 0,
        cropX: img.cropX ?? 0,
        cropY: img.cropY ?? 0,
        cropW: img.cropW ?? 1,
        cropH: img.cropH ?? 1,
      },
      update: {
        urlOrigin: img.urlOrigin,
        urlPicto: img.urlPicto,
        urlPetite: img.urlPetite,
        urlMoyenne: img.urlMoyenne ?? img.urlOrigin,
        urlGrande: img.urlGrande,
        titleFr: img.titleFr ?? "",
        titleEn: img.titleEn ?? "",
        descriptionFr: img.descriptionFr,
        descriptionEn: img.descriptionEn,
        takenAt: img.takenAt ? new Date(img.takenAt) : null,
        focusX: img.focusX ?? 0.5,
        focusY: img.focusY ?? 0.5,
        zoom: img.zoom ?? 1,
        rotation: img.rotation ?? 0,
        cropX: img.cropX ?? 0,
        cropY: img.cropY ?? 0,
        cropW: img.cropW ?? 1,
        cropH: img.cropH ?? 1,
      },
    });
    await prisma.postMedia.create({
      data: {
        postId: payload.id,
        mediaId: img.id,
        sortOrder: img.sortOrder,
        isCover: img.sortOrder === 0,
      },
    });
  }

  return prisma.post.findUnique({
    where: { id: payload.id },
    include: postInclude,
  });
}

/**
 * Pull all PROD posts onto TEST:
 * - same id → overwrite
 * - TEST-only posts → keep
 */
export async function applyProdPostsToTest(prodPosts: SyncPostPayload[]) {
  let overwritten = 0;
  let created = 0;
  for (const post of prodPosts) {
    const existing = await prisma.post.findUnique({ where: { id: post.id } });
    await upsertPostFromSync(post);
    if (existing) overwritten += 1;
    else created += 1;
  }
  return { overwritten, created, total: prodPosts.length };
}
