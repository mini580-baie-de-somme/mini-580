"use client";

import { parseArticleBodySegments } from "@/lib/article-body-segments";
import { normalizeLegacyBodyText } from "@/lib/article-markdown";
import type { PublicExternalLink, PublicMediaGroup } from "@/lib/article-media-types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { InlineExternalLink } from "./InlineExternalLink";
import { InlineMediaGroup } from "./InlineMediaGroup";

export const articleProseClassName =
  "article-prose prose prose-slate w-full max-w-none text-[1.0625rem] leading-[1.75] sm:text-lg sm:leading-8 lg:text-[1.125rem] lg:leading-8 prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-[#0D131A] prose-h2:mt-10 prose-h2:mb-4 prose-h3:mt-8 prose-h3:mb-3 prose-p:text-[#0D131A]/90 prose-p:leading-relaxed prose-strong:text-[#0D131A] prose-li:text-[#0D131A]/90 prose-li:leading-relaxed prose-a:text-[#495867] prose-a:underline-offset-2 hover:prose-a:text-[#0D131A] prose-img:w-full prose-img:rounded-lg prose-blockquote:border-[#d4dde6] prose-blockquote:text-[#495867]";

export function ArticleBody({
  content,
  locale = "fr",
  mediaGroups = {},
  externalLinks = {},
  onOpenMediaGroup,
}: {
  content: string;
  locale?: "fr" | "en";
  mediaGroups?: Record<string, PublicMediaGroup>;
  externalLinks?: Record<string, PublicExternalLink>;
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
      <div className={articleProseClassName}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{normalized}</ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 sm:space-y-8">
      {segments.map((segment, index) => {
        if (segment.type === "text") {
          if (!segment.content.trim()) return null;
          return (
            <div key={`text-${index}`} className={articleProseClassName}>
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
