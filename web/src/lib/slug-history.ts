import "server-only";

import { prisma } from "@/lib/db";
import { blogPathForSlug } from "@/lib/site-url";

export type SlugEntity = "post" | "media" | "media-group";

export type SlugRedirectResolution = {
  entity: SlugEntity;
  entityId: string;
  requestedSlug: string;
  canonicalSlug: string;
  redirectPath: string | null;
};

/** Record a slug rename for SEO 301 chains. No-op when unchanged or empty. */
export async function recordSlugChange(
  entity: SlugEntity,
  entityId: string,
  oldSlug: string,
  newSlug: string
): Promise<void> {
  const prev = oldSlug.trim();
  const next = newSlug.trim();
  if (!prev || !next || prev === next) return;

  if (entity === "post") {
    await prisma.postSlugHistory.create({
      data: { postId: entityId, oldSlug: prev, newSlug: next },
    });
    return;
  }
  if (entity === "media") {
    await prisma.mediaSlugHistory.create({
      data: { mediaId: entityId, oldSlug: prev, newSlug: next },
    });
    return;
  }
  await prisma.mediaGroupSlugHistory.create({
    data: { groupId: entityId, oldSlug: prev, newSlug: next },
  });
}

/** Resolve a slug to its canonical target; returns redirectPath when a 301 is needed. */
export async function resolveSlugRedirect(
  entity: SlugEntity,
  slug: string
): Promise<SlugRedirectResolution | null> {
  const requested = slug.trim();
  if (!requested) return null;

  if (entity === "post") {
    const direct = await prisma.post.findUnique({
      where: { slug: requested },
      select: { id: true, slug: true, status: true },
    });
    if (direct) {
      return {
        entity,
        entityId: direct.id,
        requestedSlug: requested,
        canonicalSlug: direct.slug,
        redirectPath: null,
      };
    }

    const history = await prisma.postSlugHistory.findFirst({
      where: { oldSlug: requested },
      orderBy: { changedAt: "desc" },
      include: { post: { select: { id: true, slug: true, status: true } } },
    });
    if (!history) return null;

    return {
      entity,
      entityId: history.postId,
      requestedSlug: requested,
      canonicalSlug: history.post.slug,
      redirectPath:
        history.post.slug !== requested
          ? blogPathForSlug(history.post.slug)
          : null,
    };
  }

  if (entity === "media") {
    const direct = await prisma.media.findFirst({
      where: { slug: requested },
      select: { id: true, slug: true },
    });
    if (direct?.slug) {
      return {
        entity,
        entityId: direct.id,
        requestedSlug: requested,
        canonicalSlug: direct.slug,
        redirectPath: null,
      };
    }

    const history = await prisma.mediaSlugHistory.findFirst({
      where: { oldSlug: requested },
      orderBy: { changedAt: "desc" },
      include: { media: { select: { id: true, slug: true } } },
    });
    if (!history?.media.slug) return null;

    return {
      entity,
      entityId: history.mediaId,
      requestedSlug: requested,
      canonicalSlug: history.media.slug,
      redirectPath:
        history.media.slug !== requested ? `/galerie?media=${history.mediaId}` : null,
    };
  }

  const direct = await prisma.mediaGroup.findUnique({
    where: { slug: requested },
    select: { id: true, slug: true },
  });
  if (direct) {
    return {
      entity,
      entityId: direct.id,
      requestedSlug: requested,
      canonicalSlug: direct.slug,
      redirectPath: null,
    };
  }

  const history = await prisma.mediaGroupSlugHistory.findFirst({
    where: { oldSlug: requested },
    orderBy: { changedAt: "desc" },
    include: { group: { select: { id: true, slug: true } } },
  });
  if (!history) return null;

  return {
    entity,
    entityId: history.groupId,
    requestedSlug: requested,
    canonicalSlug: history.group.slug,
    redirectPath:
      history.group.slug !== requested
        ? `/editeur/galerie?group=${history.groupId}`
        : null,
  };
}
