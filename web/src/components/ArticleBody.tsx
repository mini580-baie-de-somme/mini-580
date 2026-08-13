"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseArticleBodySegments } from "@/lib/article-body-segments";
import { normalizeLegacyBodyText } from "@/lib/article-markdown";
import type { PublicMediaGroup } from "@/lib/article-media-types";
import { InlineMediaGroup } from "./InlineMediaGroup";

const proseClassName =
  "prose prose-slate max-w-none prose-headings:text-[#0D131A] prose-p:text-[#0D131A]/90 prose-strong:text-[#0D131A] prose-li:text-[#0D131A]/90";

export function ArticleBody({
  content,
  locale = "fr",
  mediaGroups = {},
  manifestIndexByGroupId = {},
  onOpenMediaGroup,
}: {
  content: string;
  locale?: "fr" | "en";
  mediaGroups?: Record<string, PublicMediaGroup>;
  manifestIndexByGroupId?: Record<string, number>;
  onOpenMediaGroup?: (groupId: string) => void;
}) {
  const normalized = normalizeLegacyBodyText(content);
  if (!normalized.trim()) return null;

  const segments = parseArticleBodySegments(normalized);
  const hasGroups = segments.some((segment) => segment.type === "media-group");

  if (!hasGroups) {
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

        const group = mediaGroups[segment.groupId] ?? null;
        const manifestIndex = manifestIndexByGroupId[segment.groupId];

        return (
          <InlineMediaGroup
            key={`group-${segment.groupId}-${index}`}
            group={group}
            locale={locale}
            manifestIndex={manifestIndex}
            onOpen={() => onOpenMediaGroup?.(segment.groupId)}
          />
        );
      })}
    </div>
  );
}
