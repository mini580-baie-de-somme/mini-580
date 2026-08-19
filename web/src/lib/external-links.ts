import "server-only";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { externalLinkPlaceholder, resolveExternalLinkUrl } from "@/lib/external-link-token";
import type { ExternalLink } from "@/generated/prisma/client";

export { resolveExternalLinkUrl };

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeExternalLinkUrls(input: {
  url?: string | null;
  urlFr?: string | null;
  urlEn?: string | null;
}): { url: string | null; urlFr: string | null; urlEn: string | null } {
  const single = input.url?.trim() ?? "";
  const urlFr = input.urlFr?.trim() ?? "";
  const urlEn = input.urlEn?.trim() ?? "";

  if (single) {
    return { url: single, urlFr: null, urlEn: null };
  }
  if (urlFr && urlEn) {
    return { url: null, urlFr, urlEn };
  }
  return { url: null, urlFr: null, urlEn: null };
}

const urlField = z.string().nullish();

export const createExternalLinkSchema = z
  .object({
    labelFr: z.string().optional(),
    labelEn: z.string().optional(),
    url: urlField,
    urlFr: urlField,
    urlEn: urlField,
  })
  .superRefine((data, ctx) => {
    const normalized = normalizeExternalLinkUrls(data);
    const hasAnyUrl = Boolean(normalized.url || normalized.urlFr || normalized.urlEn);
    if (!hasAnyUrl) return;

    if (normalized.url) {
      if (!isValidHttpUrl(normalized.url)) {
        ctx.addIssue({ code: "custom", path: ["url"], message: "Invalid URL" });
      }
      return;
    }
    if (normalized.urlFr && normalized.urlEn) {
      if (!isValidHttpUrl(normalized.urlFr)) {
        ctx.addIssue({ code: "custom", path: ["urlFr"], message: "Invalid URL" });
      }
      if (!isValidHttpUrl(normalized.urlEn)) {
        ctx.addIssue({ code: "custom", path: ["urlEn"], message: "Invalid URL" });
      }
      return;
    }
    ctx.addIssue({
      code: "custom",
      message: "Either url or both urlFr and urlEn are required",
    });
  });

export const updateExternalLinkSchema = z
  .object({
    labelFr: z.string().min(1).optional(),
    labelEn: z.string().min(1).optional(),
    url: urlField.nullable(),
    urlFr: urlField.nullable(),
    urlEn: urlField.nullable(),
  })
  .superRefine((data, ctx) => {
    const hasUrlField =
      data.url !== undefined || data.urlFr !== undefined || data.urlEn !== undefined;
    if (!hasUrlField) return;

    const normalized = normalizeExternalLinkUrls({
      url: data.url ?? undefined,
      urlFr: data.urlFr ?? undefined,
      urlEn: data.urlEn ?? undefined,
    });

    if (normalized.url) {
      if (!isValidHttpUrl(normalized.url)) {
        ctx.addIssue({ code: "custom", path: ["url"], message: "Invalid URL" });
      }
      return;
    }
    if (normalized.urlFr && normalized.urlEn) {
      if (!isValidHttpUrl(normalized.urlFr)) {
        ctx.addIssue({ code: "custom", path: ["urlFr"], message: "Invalid URL" });
      }
      if (!isValidHttpUrl(normalized.urlEn)) {
        ctx.addIssue({ code: "custom", path: ["urlEn"], message: "Invalid URL" });
      }
      return;
    }
    ctx.addIssue({
      code: "custom",
      message: "Either url or both urlFr and urlEn are required",
    });
  });

export function externalLinkWhere(q?: string) {
  if (!q) return {};
  return {
    OR: [
      { labelFr: { contains: q, mode: "insensitive" as const } },
      { labelEn: { contains: q, mode: "insensitive" as const } },
      { url: { contains: q, mode: "insensitive" as const } },
      { urlFr: { contains: q, mode: "insensitive" as const } },
      { urlEn: { contains: q, mode: "insensitive" as const } },
    ],
  };
}

export async function findPostsReferencingExternalLink(linkId: string) {
  const token = externalLinkPlaceholder(linkId);
  return prisma.post.findMany({
    where: {
      OR: [{ bodyFr: { contains: token } }, { bodyEn: { contains: token } }],
    },
    select: {
      id: true,
      slug: true,
      titleFr: true,
      titleEn: true,
      status: true,
    },
    orderBy: { updatedAt: "desc" },
  });
}

export function serializeExternalLink(
  link: ExternalLink,
  referencedByPostIds?: string[]
) {
  return {
    id: link.id,
    labelFr: link.labelFr,
    labelEn: link.labelEn,
    url: link.url,
    urlFr: link.urlFr,
    urlEn: link.urlEn,
    createdAt: link.createdAt.toISOString(),
    referencedByPostIds: referencedByPostIds ?? [],
  };
}

export async function getExternalLinkDetail(id: string) {
  const link = await prisma.externalLink.findUnique({ where: { id } });
  if (!link) return null;
  const refs = await findPostsReferencingExternalLink(id);
  return serializeExternalLink(
    link,
    refs.map((p) => p.id)
  );
}
