"use client";

import Link from "next/link";
import type { HullId } from "@/lib/types";
import type { ArticleMediaPageData } from "@/lib/article-media-types";
import { useArticleMediaSlideshow } from "@/lib/article-media-slideshow";
import { ArticleBody } from "./ArticleBody";
import { BlogTaxonomyLinks } from "./BlogTaxonomyLinks";
import { HullBadgeList } from "./HullBadge";
import { MediaSlideshow } from "./MediaSlideshow";
import { PostCard } from "./PostCard";
import { useLocale } from "./LocaleProvider";

type ArticlePost = {
  slug: string;
  titleFr: string;
  titleEn: string;
  excerptFr: string;
  excerptEn: string;
  bodyFr: string;
  bodyEn: string;
  coverImageUrl: string | null;
  publishedAt: Date | string | null;
  hulls: { hull: HullId }[];
  themes: { theme: { slug: string; labelFr: string; labelEn: string } }[];
  tags: { tag: { name: string; labelFr: string; labelEn: string } }[];
  author: { name: string | null };
};

type RelatedPost = {
  slug: string;
  titleFr: string;
  titleEn: string;
  excerptFr: string;
  excerptEn: string;
  coverImageUrl: string | null;
  publishedAt: Date | string | null;
  hulls: { hull: HullId }[];
  themes: { theme: { slug: string; labelFr: string; labelEn: string } }[];
  tags: { tag: { name: string; labelFr: string; labelEn: string } }[];
};

function BackArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M14.5 5.5 8 12l6.5 6.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 12h11"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ArticleView({
  post,
  relatedPosts = [],
  mediaPage,
}: {
  post: ArticlePost;
  relatedPosts?: RelatedPost[];
  mediaPage?: ArticleMediaPageData;
}) {
  const { locale, t } = useLocale();
  const slideshow = useArticleMediaSlideshow();
  const title = locale === "fr" ? post.titleFr : post.titleEn;
  const excerpt = locale === "fr" ? post.excerptFr : post.excerptEn;
  const body = locale === "fr" ? post.bodyFr : post.bodyEn;
  const manifestIndexByGroupId =
    locale === "en"
      ? mediaPage?.manifestIndexByGroupIdEn ?? {}
      : mediaPage?.manifestIndexByGroupIdFr ?? {};
  const date = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="mx-auto flex w-full flex-col gap-10 sm:gap-12 lg:gap-14">
      <article className="w-full">
        <header className="mb-8 space-y-4 sm:mb-10 sm:space-y-5">
          {post.hulls.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <HullBadgeList hulls={post.hulls} />
            </div>
          ) : null}

          <div className="flex items-start gap-3 sm:gap-4">
            <Link
              href="/blog"
              aria-label={t("article.back")}
              title={t("article.back")}
              className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#d4dde6] bg-white text-[#495867] shadow-sm transition hover:border-[#495867] hover:bg-[#eef3f7] hover:text-[#0D131A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#495867] focus-visible:ring-offset-2 sm:mt-1 sm:h-11 sm:w-11"
            >
              <BackArrowIcon className="h-5 w-5 sm:h-6 sm:w-6" />
            </Link>
            <div className="min-w-0 flex-1 space-y-2 sm:space-y-3">
              <h1 className="text-[clamp(1.75rem,5vw,2.75rem)] font-bold leading-tight tracking-tight text-[#0D131A]">
                {title}
              </h1>
              {date && post.publishedAt ? (
                <time
                  dateTime={new Date(post.publishedAt).toISOString()}
                  className="block text-sm text-[#495867] sm:text-base"
                >
                  {date}
                </time>
              ) : null}
              <BlogTaxonomyLinks
                themes={post.themes.map(({ theme }) => theme)}
                tags={post.tags.map(({ tag }) => tag)}
                className="pl-0"
              />
            </div>
          </div>

          {excerpt ? (
            <p className="text-base leading-relaxed text-[#495867] sm:text-lg sm:leading-8">
              {excerpt}
            </p>
          ) : null}

          {post.author.name ? (
            <p className="text-sm text-[#495867] sm:text-base">{post.author.name}</p>
          ) : null}
        </header>

        {post.coverImageUrl && (
          <div className="mb-8 overflow-hidden rounded-xl shadow-sm sm:mb-10">
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
          locale={locale}
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
        />
      </article>

      {relatedPosts.length > 0 && (
        <section className="w-full border-t border-[#d4dde6] pt-8 sm:pt-10">
          <div className="w-full">
            <h2 className="text-xl font-semibold text-[#0D131A] sm:text-2xl">
              {t("article.related")}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-[#495867] sm:text-base">
              {t("article.relatedHint")}
            </p>
          </div>
          <div
            className={`mt-6 grid w-full grid-cols-1 items-stretch gap-5 sm:mt-8 sm:gap-6 ${
              relatedPosts.length === 1
                ? "sm:grid-cols-1 lg:max-w-md"
                : relatedPosts.length === 2
                  ? "sm:grid-cols-2"
                  : "sm:grid-cols-2 lg:grid-cols-3"
            }`}
          >
            {relatedPosts.map((related) => (
              <PostCard key={related.slug} post={related} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export type { ArticlePost, RelatedPost };
