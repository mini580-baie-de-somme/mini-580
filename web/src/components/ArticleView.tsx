"use client";

import Link from "next/link";
import type { HullId } from "@/lib/types";
import { resolveThumbKind } from "@/lib/media-file-client";
import { ArticleBody } from "./LangToggle";
import { GalleryImage } from "./GalleryImage";
import { HullBadgeList } from "./HullBadge";
import { MediaKindThumb } from "./MediaKindThumb";
import { MediaSlideshow, useMediaSlideshow } from "./MediaSlideshow";
import { PostCard } from "./PostCard";
import { useLocale } from "./LocaleProvider";

type ArticleImage = {
  id?: string;
  kind?: string | null;
  mimeType?: string | null;
  urlOrigin?: string;
  url?: string;
  urlMoyenne?: string | null;
  urlGrande?: string | null;
  urlPetite?: string | null;
  urlPicto?: string | null;
  titleFr?: string;
  titleEn?: string;
  descriptionFr?: string;
  descriptionEn?: string;
  captionFr?: string;
  captionEn?: string;
  focusX?: number;
  focusY?: number;
  zoom?: number;
  rotation?: number;
  cropX?: number;
  cropY?: number;
  cropW?: number;
  cropH?: number;
};

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
  tags: { tag: { labelFr: string; labelEn: string } }[];
  images: ArticleImage[];
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
};

function imageSrc(img: ArticleImage): string {
  return (
    img.urlPetite ||
    img.urlPicto ||
    img.urlMoyenne ||
    img.urlOrigin ||
    img.url ||
    ""
  );
}

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
}: {
  post: ArticlePost;
  relatedPosts?: RelatedPost[];
}) {
  const { locale, t } = useLocale();
  const slideshow = useMediaSlideshow();
  const title = locale === "fr" ? post.titleFr : post.titleEn;
  const excerpt = locale === "fr" ? post.excerptFr : post.excerptEn;
  const body = locale === "fr" ? post.bodyFr : post.bodyEn;
  const date = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 sm:gap-12">
      <article className="mx-auto w-full max-w-3xl">
        <header className="mb-8 space-y-4 sm:mb-10 sm:space-y-5">
          <div className="flex flex-wrap gap-2">
            <HullBadgeList hulls={post.hulls} />
            {post.tags.map(({ tag }) => (
              <span
                key={tag.labelFr}
                className="rounded bg-[#eef3f7] px-2 py-0.5 text-xs text-[#495867]"
              >
                {locale === "fr" ? tag.labelFr : tag.labelEn}
              </span>
            ))}
          </div>

          <div className="flex items-start gap-3 sm:gap-4">
            <Link
              href="/blog"
              aria-label={t("article.back")}
              title={t("article.back")}
              className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#d4dde6] bg-white text-[#495867] shadow-sm transition hover:border-[#495867] hover:bg-[#eef3f7] hover:text-[#0D131A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#495867] focus-visible:ring-offset-2 sm:mt-1 sm:h-11 sm:w-11"
            >
              <BackArrowIcon className="h-5 w-5 sm:h-6 sm:w-6" />
            </Link>
            <h1 className="min-w-0 flex-1 text-2xl font-bold leading-tight text-[#0D131A] sm:text-4xl sm:leading-tight">
              {title}
            </h1>
          </div>

          {excerpt ? (
            <p className="text-base leading-relaxed text-[#495867] sm:text-lg">
              {excerpt}
            </p>
          ) : null}

          {(date || post.author.name) && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[#495867]">
              {date && <time>{date}</time>}
              {date && post.author.name && (
                <span aria-hidden className="text-[#b0bcc8]">
                  ·
                </span>
              )}
              {post.author.name && <span>{post.author.name}</span>}
            </p>
          )}
        </header>

        {post.coverImageUrl && (
          <div className="mb-8 overflow-hidden rounded-lg shadow-sm sm:mb-10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.coverImageUrl}
              alt=""
              className="aspect-[16/10] w-full object-cover sm:aspect-[2/1]"
            />
          </div>
        )}

        <ArticleBody content={body} />

        {post.images.length > 0 && (
          <section className="mt-10 border-t border-[#d4dde6] pt-8 sm:mt-12 sm:pt-10">
            <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-semibold text-[#0D131A]">
                {t("article.gallery")}
              </h2>
              {post.images.length > 1 && (
                <button
                  type="button"
                  onClick={() => slideshow.startSlideshow(0)}
                  className="w-full rounded-md border border-[#495867] bg-[#495867] px-3 py-2 text-sm text-white hover:bg-[#3a4654] sm:w-auto sm:py-1.5"
                >
                  {t("gallery.startSlideshow")}
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
              {post.images.map((img, i) => {
                const displayKind = resolveThumbKind(
                  img.kind,
                  img.mimeType,
                  img.urlOrigin || img.url
                );
                const src = imageSrc(img);
                const label =
                  (locale === "fr" ? img.titleFr : img.titleEn) ||
                  t("gallery.untitled");
                return (
                  <button
                    key={img.id ?? i}
                    type="button"
                    onClick={() => slideshow.openViewer(i)}
                    className="w-full text-left transition hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#495867] focus-visible:ring-offset-2"
                  >
                    {displayKind === "IMAGE" && src ? (
                      <GalleryImage image={img} locale={locale} />
                    ) : (
                      <div className="overflow-hidden rounded-lg border border-[#d4dde6] bg-white shadow-sm">
                        <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 bg-[#eef3f7] text-[#495867]">
                          <MediaKindThumb
                            kind={displayKind}
                            mimeType={img.mimeType}
                            src={null}
                            size="md"
                            className="h-16 w-16 bg-transparent"
                          />
                          <span className="text-xs uppercase tracking-wide">
                            {displayKind === "DOCUMENT"
                              ? "PDF"
                              : t("gallery.kind.video")}
                          </span>
                        </div>
                        <div className="px-4 py-3 text-sm text-[#495867]">
                          <div className="font-medium text-[#0D131A]">{label}</div>
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <MediaSlideshow
          items={post.images}
          open={slideshow.open}
          initialIndex={slideshow.initialIndex}
          initialAutoPlay={slideshow.initialAutoPlay}
          onClose={slideshow.close}
        />
      </article>

      {relatedPosts.length > 0 && (
        <section className="w-full border-t border-[#d4dde6] pt-8 sm:pt-10">
          <div className="max-w-3xl">
            <h2 className="text-xl font-semibold text-[#0D131A]">
              {t("article.related")}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-[#495867]">
              {t("article.relatedHint")}
            </p>
          </div>
          <div
            className={`mt-6 grid grid-cols-1 items-stretch gap-5 sm:mt-8 sm:gap-6 ${
              relatedPosts.length === 1
                ? "sm:grid-cols-1 sm:max-w-md"
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
