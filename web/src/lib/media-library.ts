import "server-only";

import { MediaKind, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  kindFromContentType,
  maxBytesForContentType,
  normalizeContentType,
} from "@/lib/media-bucket";
import {
  bakeVariantsFromOrigin,
  deleteMediaUrls,
  storeOriginAndVariants,
  type MediaVariantUrls,
  type RebakedVariantUrls,
} from "@/lib/media-variants";
import {
  layoutForRebake,
  type ImageLayoutParams,
  type LegacyMediaTransform,
} from "@/lib/image-layout";
import {
  mediaTrace,
  newMediaTraceId,
  type MediaTraceContext,
} from "@/lib/media-trace";
import { EDITOR_LIST_PAGE_SIZE } from "@/lib/constants";

export const mediaInclude = {
  posts: {
    include: {
      post: {
        select: {
          id: true,
          slug: true,
          titleFr: true,
          titleEn: true,
          status: true,
        },
      },
    },
  },
} satisfies Prisma.MediaInclude;

export type MediaWithPosts = Prisma.MediaGetPayload<{ include: typeof mediaInclude }>;

export const postMediaInclude = {
  media: true,
} satisfies Prisma.PostMediaInclude;

export function mediaWhere(filters?: {
  q?: string;
  kind?: string;
  visibility?: string;
}): Prisma.MediaWhereInput {
  const where: Prisma.MediaWhereInput = {};
  if (filters?.kind && filters.kind !== "ALL") {
    const kind = filters.kind as MediaKind;
    if (Object.values(MediaKind).includes(kind)) {
      where.kind = kind;
    }
  }
  const visibility = filters?.visibility?.trim().toLowerCase();
  if (visibility === "public") {
    where.posts = { some: { post: { status: "PUBLISHED" } } };
  } else if (visibility === "draft") {
    where.AND = [
      { posts: { some: {} } },
      { posts: { none: { post: { status: "PUBLISHED" } } } },
    ];
  } else if (visibility === "orphan") {
    where.posts = { none: {} };
  }
  const q = filters?.q?.trim();
  if (q) {
    where.OR = [
      { titleFr: { contains: q, mode: "insensitive" } },
      { titleEn: { contains: q, mode: "insensitive" } },
      { descriptionFr: { contains: q, mode: "insensitive" } },
      { descriptionEn: { contains: q, mode: "insensitive" } },
      { mimeType: { contains: q, mode: "insensitive" } },
    ];
  }
  return where;
}

export function parseMediaListParams(searchParams: URLSearchParams) {
  const q = searchParams.get("q")?.trim() || undefined;
  const kind = searchParams.get("kind") ?? undefined;
  const visibility = searchParams.get("visibility") ?? undefined;
  const limit = Math.min(
    100,
    Math.max(
      1,
      Number.parseInt(searchParams.get("limit") ?? String(EDITOR_LIST_PAGE_SIZE), 10) ||
        EDITOR_LIST_PAGE_SIZE
    )
  );
  const offset = Math.max(0, Number.parseInt(searchParams.get("offset") ?? "0", 10) || 0);
  return { q, kind, visibility, limit, offset };
}

/** Shape expected by legacy post image consumers (includes sortOrder from link). */
export function mediaAsPostImage(
  media: {
    id: string;
    kind?: string;
    mimeType?: string;
    urlOrigin: string;
    urlPicto: string | null;
    urlPetite: string | null;
    urlMoyenne: string | null;
    urlGrande: string | null;
    titleFr: string;
    titleEn: string;
    descriptionFr: string;
    descriptionEn: string;
    takenAt: Date | null;
    focusX: number;
    focusY: number;
    zoom: number;
    rotation: number;
    cropX: number;
    cropY: number;
    cropW: number;
    cropH: number;
  },
  link: { sortOrder: number; isCover?: boolean; postId?: string }
) {
  return {
    id: media.id,
    postId: link.postId ?? "",
    kind: media.kind ?? "IMAGE",
    mimeType: media.mimeType ?? null,
    urlOrigin: media.urlOrigin,
    urlPicto: media.urlPicto,
    urlPetite: media.urlPetite,
    urlMoyenne: media.urlMoyenne,
    urlGrande: media.urlGrande,
    titleFr: media.titleFr,
    titleEn: media.titleEn,
    descriptionFr: media.descriptionFr,
    descriptionEn: media.descriptionEn,
    takenAt: media.takenAt,
    sortOrder: link.sortOrder,
    offsetX: "offsetX" in media ? Number(media.offsetX ?? 0) : 0,
    offsetY: "offsetY" in media ? Number(media.offsetY ?? 0) : 0,
    scaleX: "scaleX" in media ? Number(media.scaleX ?? 1) : 1,
    scaleY: "scaleY" in media ? Number(media.scaleY ?? 1) : 1,
    lockAspect: "lockAspect" in media ? Boolean(media.lockAspect ?? true) : true,
    cropShape: "cropShape" in media ? String(media.cropShape ?? "RECT") : "RECT",
    backgroundColor:
      "backgroundColor" in media
        ? String(media.backgroundColor ?? "#000000")
        : "#000000",
    cropInset: "cropInset" in media ? Number(media.cropInset ?? 0.06) : 0.06,
    focusX: media.focusX,
    focusY: media.focusY,
    zoom: media.zoom,
    rotation: media.rotation,
    cropX: media.cropX,
    cropY: media.cropY,
    cropW: media.cropW,
    cropH: media.cropH,
    isCover: link.isCover ?? false,
  };
}

/** Flatten post.mediaLinks into legacy PostImage-shaped rows for UI/compat. */
export function imagesFromPostMediaLinks(
  mediaLinks: Array<{
    sortOrder: number;
    isCover: boolean;
    postId?: string;
    media: Parameters<typeof mediaAsPostImage>[0];
  }>
) {
  return [...mediaLinks]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((l) => mediaAsPostImage(l.media, l));
}

export async function listPostMediaAsImages(postId: string) {
  const links = await prisma.postMedia.findMany({
    where: { postId },
    include: { media: true },
    orderBy: { sortOrder: "asc" },
  });
  return links.map((l) => mediaAsPostImage(l.media, { ...l, postId }));
}

export async function createMediaFromUpload(opts: {
  buffer: Buffer;
  contentType: string;
  filename?: string;
  meta?: {
    titleFr?: string;
    titleEn?: string;
    descriptionFr?: string;
    descriptionEn?: string;
    takenAt?: Date | null;
  };
}) {
  const contentType = normalizeContentType(opts.contentType);
  const kindHint = kindFromContentType(contentType);
  if (!kindHint) {
    throw new Error("Unsupported Content-Type");
  }
  const max = maxBytesForContentType(contentType);
  if (opts.buffer.byteLength > max) {
    throw new Error(`File too large (max ${Math.round(max / (1024 * 1024))}MB)`);
  }

  const kind = MediaKind[kindHint];
  let urls: {
    urlOrigin: string;
    urlPicto: string | null;
    urlPetite: string | null;
    urlMoyenne: string | null;
    urlGrande: string | null;
  };

  if (kind === MediaKind.IMAGE) {
    const stored = await storeOriginAndVariants(opts.buffer, contentType);
    urls = stored;
  } else {
    const { getMediaBucket } = await import("@/lib/media-bucket");
    const bucket = getMediaBucket();
    const key = bucket.createObjectKey(opts.filename || `upload.${kindHint.toLowerCase()}`);
    const put = await bucket.putObject(key, opts.buffer, contentType);
    urls = {
      urlOrigin: put.url,
      urlPicto: null,
      urlPetite: null,
      urlMoyenne: null,
      urlGrande: null,
    };
  }

  return prisma.media.create({
    data: {
      kind,
      mimeType: contentType,
      byteSize: opts.buffer.byteLength,
      urlOrigin: urls.urlOrigin,
      urlPicto: urls.urlPicto,
      urlPetite: urls.urlPetite,
      urlMoyenne: urls.urlMoyenne,
      urlGrande: urls.urlGrande,
      titleFr: opts.meta?.titleFr ?? "",
      titleEn: opts.meta?.titleEn ?? "",
      descriptionFr: opts.meta?.descriptionFr ?? "",
      descriptionEn: opts.meta?.descriptionEn ?? "",
      takenAt: opts.meta?.takenAt ?? null,
    },
    include: mediaInclude,
  });
}

export async function createMediaFromUrls(data: {
  kind?: MediaKind;
  mimeType?: string;
  urlOrigin: string;
  urlPicto?: string | null;
  urlPetite?: string | null;
  urlMoyenne?: string | null;
  urlGrande?: string | null;
  titleFr?: string;
  titleEn?: string;
  descriptionFr?: string;
  descriptionEn?: string;
  takenAt?: Date | null;
  focusX?: number;
  focusY?: number;
  zoom?: number;
  rotation?: number;
  cropX?: number;
  cropY?: number;
  cropW?: number;
  cropH?: number;
}) {
  const mimeType = data.mimeType ?? "image/jpeg";
  const kind =
    data.kind ??
    (kindFromContentType(mimeType) === "DOCUMENT"
      ? MediaKind.DOCUMENT
      : kindFromContentType(mimeType) === "VIDEO"
        ? MediaKind.VIDEO
        : MediaKind.IMAGE);

  return prisma.media.create({
    data: {
      kind,
      mimeType,
      urlOrigin: data.urlOrigin,
      urlPicto: data.urlPicto ?? null,
      urlPetite: data.urlPetite ?? null,
      urlMoyenne: data.urlMoyenne ?? (kind === MediaKind.IMAGE ? data.urlOrigin : null),
      urlGrande: data.urlGrande ?? null,
      titleFr: data.titleFr ?? "",
      titleEn: data.titleEn ?? "",
      descriptionFr: data.descriptionFr ?? "",
      descriptionEn: data.descriptionEn ?? "",
      takenAt: data.takenAt ?? null,
      focusX: data.focusX ?? 0.5,
      focusY: data.focusY ?? 0.5,
      zoom: data.zoom ?? 1,
      rotation: data.rotation ?? 0,
      cropX: data.cropX ?? 0,
      cropY: data.cropY ?? 0,
      cropW: data.cropW ?? 1,
      cropH: data.cropH ?? 1,
    },
    include: mediaInclude,
  });
}

export async function attachMediaToPost(
  postId: string,
  mediaIds: string[],
  opts?: { setCoverFirst?: boolean }
) {
  const existing = await prisma.postMedia.findMany({ where: { postId } });
  const maxOrder = existing.reduce((m, l) => Math.max(m, l.sortOrder), -1);
  let order = maxOrder + 1;
  const created = [];
  for (const mediaId of mediaIds) {
    const link = await prisma.postMedia.upsert({
      where: { postId_mediaId: { postId, mediaId } },
      create: {
        postId,
        mediaId,
        sortOrder: order,
        isCover: false,
      },
      update: {},
      include: { media: true },
    });
    if (!existing.some((e) => e.mediaId === mediaId)) {
      order += 1;
    }
    created.push(link);
  }

  if (opts?.setCoverFirst && mediaIds[0]) {
    await setPostCover(postId, mediaIds[0]);
  } else if (existing.length === 0 && mediaIds[0]) {
    await setPostCover(postId, mediaIds[0]);
  }

  return created;
}

export async function setPostCover(postId: string, mediaId: string) {
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media) throw new Error("Media not found");

  await prisma.$transaction([
    prisma.postMedia.updateMany({
      where: { postId },
      data: { isCover: false },
    }),
    prisma.postMedia.update({
      where: { postId_mediaId: { postId, mediaId } },
      data: { isCover: true },
    }),
    prisma.post.update({
      where: { id: postId },
      data: {
        coverImageUrl:
          media.kind === MediaKind.IMAGE
            ? media.urlMoyenne ?? media.urlOrigin
            : media.urlOrigin,
      },
    }),
  ]);
}

export async function detachMediaFromPost(postId: string, mediaId: string) {
  const link = await prisma.postMedia.findUnique({
    where: { postId_mediaId: { postId, mediaId } },
  });
  if (!link) return false;
  await prisma.postMedia.delete({
    where: { postId_mediaId: { postId, mediaId } },
  });
  if (link.isCover) {
    const next = await prisma.postMedia.findFirst({
      where: { postId },
      orderBy: { sortOrder: "asc" },
      include: { media: true },
    });
    if (next) {
      await setPostCover(postId, next.mediaId);
    } else {
      await prisma.post.update({
        where: { id: postId },
        data: { coverImageUrl: null },
      });
    }
  }
  return true;
}

export async function deleteMediaById(id: string, opts?: { force?: boolean }) {
  const media = await prisma.media.findUnique({
    where: { id },
    include: { posts: true },
  });
  if (!media) return { ok: false as const, status: 404 as const };

  if (media.posts.length > 0 && !opts?.force) {
    return {
      ok: false as const,
      status: 409 as const,
      linkedPostCount: media.posts.length,
    };
  }

  await deleteMediaUrls([
    media.urlOrigin,
    media.urlPicto,
    media.urlPetite,
    media.urlMoyenne,
    media.urlGrande,
  ]);
  await prisma.media.delete({ where: { id } });
  return { ok: true as const };
}

type RebakeableMedia = LegacyMediaTransform & {
  id: string;
  urlOrigin: string;
  urlPicto: string | null;
  urlPetite: string | null;
  urlMoyenne: string | null;
  urlGrande: string | null;
};

/** Rebake display variants from origin using stored layout + optional patch. */
export async function rebakeMediaVariants(
  media: RebakeableMedia,
  layoutPatch: Partial<ImageLayoutParams> = {},
  previousVariantUrls?: (string | null | undefined)[],
  trace?: MediaTraceContext
): Promise<RebakedVariantUrls> {
  const ctx: MediaTraceContext = {
    traceId: trace?.traceId ?? newMediaTraceId(),
    mediaId: trace?.mediaId ?? media.id,
    postId: trace?.postId,
  };
  const layout = layoutForRebake(media, layoutPatch);
  const stale =
    previousVariantUrls ??
    [media.urlPicto, media.urlPetite, media.urlMoyenne, media.urlGrande];
  mediaTrace(ctx, "rebakeMediaVariants.start", {
    urlOrigin: media.urlOrigin,
    layout,
  });
  return bakeVariantsFromOrigin(media.urlOrigin, layout, stale, ctx);
}

/** Collect URLs that may still be referenced as post.coverImageUrl before a rebake. */
export function collectPreviousDisplayUrls(media: RebakeableMedia): string[] {
  return [
    media.urlOrigin,
    media.urlPicto,
    media.urlPetite,
    media.urlMoyenne,
    media.urlGrande,
  ].filter((url): url is string => Boolean(url));
}

/** Keep post.coverImageUrl aligned when variant URLs rotate after a rebake. */
export async function syncCoverImageUrlsAfterRebake(
  mediaId: string,
  baked: {
    urlPicto?: string | null;
    urlPetite?: string | null;
    urlMoyenne?: string | null;
    urlGrande?: string | null;
  },
  previousDisplayUrls: (string | null | undefined)[] = []
) {
  const newCover =
    baked.urlMoyenne || baked.urlGrande || baked.urlPetite || baked.urlPicto;
  if (!newCover) return;

  const stale = new Set(
    previousDisplayUrls.filter((url): url is string => Boolean(url))
  );
  const postIds = new Set<string>();

  const coverLinks = await prisma.postMedia.findMany({
    where: { mediaId, isCover: true },
    select: { postId: true },
  });
  for (const link of coverLinks) {
    postIds.add(link.postId);
  }

  if (stale.size > 0) {
    const stalePosts = await prisma.post.findMany({
      where: { coverImageUrl: { in: [...stale] } },
      select: { id: true },
    });
    for (const post of stalePosts) {
      postIds.add(post.id);
    }
  }

  if (postIds.size === 0) return;

  await prisma.post.updateMany({
    where: { id: { in: [...postIds] } },
    data: { coverImageUrl: newCover },
  });
}

export async function collectMediaUrlKeys(media: {
  urlOrigin: string;
  urlPicto?: string | null;
  urlPetite?: string | null;
  urlMoyenne?: string | null;
  urlGrande?: string | null;
}): Promise<string[]> {
  const { mediaKeyFromUrl } = await import("@/lib/media-bucket");
  return [
    media.urlOrigin,
    media.urlPicto,
    media.urlPetite,
    media.urlMoyenne,
    media.urlGrande,
  ]
    .filter((u): u is string => Boolean(u))
    .map((u) => mediaKeyFromUrl(u))
    .filter((k): k is string => Boolean(k));
}
