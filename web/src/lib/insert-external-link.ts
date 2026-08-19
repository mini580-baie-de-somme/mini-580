import "server-only";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { resolveExternalLinkDisplayName } from "@/lib/external-link-display";
import {
  externalLinkPlaceholder,
  resolveExternalLinkUrl,
} from "@/lib/external-link-token";
import { postInclude, serializePostForApi } from "@/lib/posts";

export const insertExternalLinkSchema = z.object({
  linkId: z.string().min(1),
  lang: z.enum(["fr", "en", "both"]).default("both"),
  position: z.enum(["end", "start"]).default("end"),
});

export type InsertExternalLinkInput = z.infer<typeof insertExternalLinkSchema>;

function injectPlaceholder(body: string, linkId: string, position: "end" | "start"): string {
  const token = externalLinkPlaceholder(linkId);
  const block = `\n\n${token}\n\n`;
  const trimmed = body.trim();

  if (position === "start") {
    return trimmed ? `${block.trimStart()}${body}` : token;
  }
  return trimmed ? `${body.trimEnd()}${block}` : token;
}

export async function insertExternalLinkInPost(
  postId: string,
  input: InsertExternalLinkInput
) {
  const [post, link] = await Promise.all([
    prisma.post.findUnique({ where: { id: postId } }),
    prisma.externalLink.findUnique({ where: { id: input.linkId } }),
  ]);

  if (!post) return { error: "Post not found" as const, status: 404 as const };
  if (!link) return { error: "External link not found" as const, status: 404 as const };

  const data: { bodyFr?: string; bodyEn?: string } = {};

  if (input.lang === "fr" || input.lang === "both") {
    data.bodyFr = injectPlaceholder(post.bodyFr ?? "", input.linkId, input.position);
  }
  if (input.lang === "en" || input.lang === "both") {
    data.bodyEn = injectPlaceholder(post.bodyEn ?? "", input.linkId, input.position);
  }

  const updated = await prisma.post.update({
    where: { id: postId },
    data,
    include: postInclude,
  });

  return {
    post: serializePostForApi(updated),
    inserted: {
      linkId: input.linkId,
      lang: input.lang,
      position: input.position,
      placeholder: externalLinkPlaceholder(input.linkId),
      labelFr: link.labelFr,
      labelEn: link.labelEn,
      url: resolveExternalLinkUrl(link, "fr") || resolveExternalLinkUrl(link, "en"),
      urlFr: link.urlFr,
      urlEn: link.urlEn,
      displayNameFr: resolveExternalLinkDisplayName(link, "fr", link.id),
      displayNameEn: resolveExternalLinkDisplayName(link, "en", link.id),
    },
  };
}
