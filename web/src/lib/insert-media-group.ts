import "server-only";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { mediaGroupPlaceholder } from "@/lib/media-group-token";
import { postInclude, serializePostForApi } from "@/lib/posts";

export const insertMediaGroupSchema = z.object({
  groupId: z.string().min(1),
  lang: z.enum(["fr", "en", "both"]).default("both"),
  position: z.enum(["end", "start"]).default("end"),
});

export type InsertMediaGroupInput = z.infer<typeof insertMediaGroupSchema>;

function injectPlaceholder(body: string, groupId: string, position: "end" | "start"): string {
  const token = mediaGroupPlaceholder(groupId);
  const block = `\n\n${token}\n\n`;
  const trimmed = body.trim();

  if (position === "start") {
    return trimmed ? `${block.trimStart()}${body}` : token;
  }
  return trimmed ? `${body.trimEnd()}${block}` : token;
}

export async function insertMediaGroupInPost(postId: string, input: InsertMediaGroupInput) {
  const [post, group] = await Promise.all([
    prisma.post.findUnique({ where: { id: postId } }),
    prisma.mediaGroup.findUnique({ where: { id: input.groupId } }),
  ]);

  if (!post) return { error: "Post not found" as const, status: 404 as const };
  if (!group) return { error: "Media group not found" as const, status: 404 as const };

  const data: { bodyFr?: string; bodyEn?: string } = {};

  if (input.lang === "fr" || input.lang === "both") {
    data.bodyFr = injectPlaceholder(post.bodyFr ?? "", input.groupId, input.position);
  }
  if (input.lang === "en" || input.lang === "both") {
    data.bodyEn = injectPlaceholder(post.bodyEn ?? "", input.groupId, input.position);
  }

  const updated = await prisma.post.update({
    where: { id: postId },
    data,
    include: postInclude,
  });

  return {
    post: serializePostForApi(updated),
    inserted: {
      groupId: input.groupId,
      lang: input.lang,
      position: input.position,
      placeholder: mediaGroupPlaceholder(input.groupId),
    },
  };
}
