"use client";

import { parseArticleBodySegments } from "@/lib/article-body-segments";
import { normalizeLegacyBodyText } from "@/lib/article-markdown";
import type { PublicExternalLink, PublicMediaGroup } from "@/lib/article-media-types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { InlineExternalLink } from "./InlineExternalLink";
import { InlineMediaGroup } from "./InlineMediaGroup";

const proseClassName =
  "prose prose-slate max-w-none prose-headings:text-[#0D131A] prose-p:text-[#0D131A]/90 prose-strong:text-[#0D131A] prose-li:text-[#0D131A]/90";

export function ArticleBody({
  content,
  locale = "fr",
  mediaGroups = {},
  externalLinks = {},
  manifestIndexByGroupId = {},
  onOpenMediaGroup,
}: {
  content: string;
  locale?: "fr" | "en";
  mediaGroups?: Record<string, PublicMediaGroup>;
  externalLinks?: Record<string, PublicExternalLink>;
  manifestIndexByGroupId?: Record<string, number>;
  onOpenMediaGroup?: (groupId: string) => void;
}) {
  const normalized = normalizeLegacyBodyText(content);
  if (!normalized.trim()) return null;

  const segments = parseArticleBodySegments(normalized);
  const hasInlineBlocks = segments.some(
    (segment) => segment.type !== "text"
  );

  if (!hasInlineBlocks) {
    return (
      <div className={proseClassName}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{normalized}</ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {segments.map((segment, index) => {
        if (segment.type === "text") {
          if (!segment.content.trim()) return null;
          return (
            <div key={`text-${index}`} className={proseClassName}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {segment.content}
              </ReactMarkdown>
            </div>
          );
        }

        if (segment.type === "media-group") {
          const group = mediaGroups[segment.groupId] ?? null;
          return (
            <InlineMediaGroup
              key={`group-${segment.groupId}-${index}`}
              group={group}
              locale={locale}
              onOpen={() => onOpenMediaGroup?.(segment.groupId)}
            />
          );
        }

        const link = externalLinks[segment.linkId] ?? null;
        return (
          <InlineExternalLink
            key={`link-${segment.linkId}-${index}`}
            link={link}
            locale={locale}
          />
        );
      })}
    </div>
  );
}
