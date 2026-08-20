"use client";

import Link from "next/link";
import { useState } from "react";
import type { HullId } from "@/lib/types";
import type { ArticleMediaPageData } from "@/lib/article-media-types";
import { useArticleMediaSlideshow } from "@/lib/article-media-slideshow";
import { ArticleBody } from "./ArticleBody";
import { LangToggle } from "./LangToggle";
import { HullBadgeList } from "./HullBadge";
import { MediaSlideshow } from "./MediaSlideshow";

type PreviewPost = {
  id: string;
  slug: string;
  titleFr: string;
  titleEn: string;
  excerptFr: string;
  excerptEn: string;
  bodyFr: string;
  bodyEn: string;
  status: string;
  coverImageUrl: string | null;
  publishedAt: string | null;
  hulls: { hull: HullId }[];
};

export function PreviewArticle({
  post,
  showEditorLink = true,
  mediaPage,
}: {
  post: PreviewPost;
  showEditorLink?: boolean;
  mediaPage?: ArticleMediaPageData;
}) {
  const [lang, setLang] = useState<"fr" | "en">("fr");
  const slideshow = useArticleMediaSlideshow();
  const title = lang === "fr" ? post.titleFr : post.titleEn;
  const excerpt = lang === "fr" ? post.excerptFr : post.excerptEn;
  const body = lang === "fr" ? post.bodyFr : post.bodyEn;
  const manifestIndexByGroupId =
    lang === "en"
      ? mediaPage?.manifestIndexByGroupIdEn ?? {}
      : mediaPage?.manifestIndexByGroupIdFr ?? {};

  return (
    <article className="w-full">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 sm:mb-8">
        <div className="min-w-0 flex-1 space-y-3">
          {post.status === "DRAFT" && (
            <span className="inline-block rounded bg-amber-100 px-2 py-1 text-xs text-amber-800">
              Aperçu brouillon
            </span>
          )}
          <h1 className="text-[clamp(1.75rem,5vw,2.75rem)] font-bold leading-tight tracking-tight text-[#0D131A]">
            {title}
          </h1>
          {excerpt ? (
            <p className="text-base leading-relaxed text-[#495867] sm:text-lg sm:leading-8">
              {excerpt}
            </p>
          ) : null}
          <div>
            <HullBadgeList hulls={post.hulls} />
          </div>
        </div>
        <LangToggle lang={lang} onChange={setLang} />
      </div>

      {post.coverImageUrl && (
        <div className="mb-8 overflow-hidden rounded-xl sm:mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.coverImageUrl}
            alt=""
            className="aspect-[16/10] w-full object-cover sm:aspect-[2/1]"
          />
        </div>
      )}

      <ArticleBody
        content={body}
        locale={lang}
        mediaGroups={mediaPage?.mediaGroups}
        externalLinks={mediaPage?.externalLinks}
        onOpenMediaGroup={(groupId) => {
          const groups = mediaPage?.mediaGroups ?? {};
          slideshow.openAtGroup(groupId, groups, manifestIndexByGroupId);
        }}
      />

      <MediaSlideshow
        items={slideshow.scopeItems ?? []}
        open={slideshow.open}
        initialIndex={slideshow.initialIndex}
        initialAutoPlay={slideshow.initialAutoPlay}
        onClose={slideshow.close}
        locale={lang}
      />

      {showEditorLink && (
        <div className="mt-8 sm:mt-10">
          <Link href={`/editeur/${post.id}`} className="text-sm text-[#495867] hover:underline">
            ← Retour à l&apos;éditeur
          </Link>
        </div>
      )}
    </article>
  );
}
