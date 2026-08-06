"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { normalizeLegacyBodyText } from "@/lib/article-markdown";

const proseClassName =
  "prose prose-slate max-w-none prose-headings:text-[#0D131A] prose-p:text-[#0D131A]/90 prose-strong:text-[#0D131A] prose-li:text-[#0D131A]/90";

export function ArticleBody({ content }: { content: string }) {
  const normalized = normalizeLegacyBodyText(content);
  if (!normalized.trim()) return null;

  return (
    <div className={proseClassName}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{normalized}</ReactMarkdown>
    </div>
  );
}
