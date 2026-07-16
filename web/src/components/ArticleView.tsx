"use client";

import Link from "next/link";
import type { HullId } from "@/lib/types";
import { ArticleBody } from "./LangToggle";
import { HullBadgeList } from "./HullBadge";
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
  tags: { tag: { labelFr: string; labelEn: string } }[];
  images: { url: string; captionFr: string; captionEn: string }[];
  author: { name: string | null };
};

export function ArticleView({ post }: { post: ArticlePost }) {
  const { locale, t } = useLocale();
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
    <article>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
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
          <h1 className="text-3xl font-bold text-[#0D131A] sm:text-4xl">{title}</h1>
          {excerpt && <p className="mt-3 text-lg text-[#495867]">{excerpt}</p>}
          <div className="mt-3 flex flex-wrap gap-3 text-sm text-[#495867]">
            {date && <time>{date}</time>}
            {post.author.name && <span>{post.author.name}</span>}
          </div>
        </div>
      </div>

      {post.coverImageUrl && (
        <div className="mb-8 overflow-hidden rounded-lg shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.coverImageUrl} alt="" className="w-full object-cover" />
        </div>
      )}

      <ArticleBody content={body} />

      {post.images.length > 0 && (
        <section className="mt-12 border-t border-[#d4dde6] pt-10">
          <h2 className="mb-6 text-xl font-semibold text-[#0D131A]">{t("article.gallery")}</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {post.images.map((img, i) => (
              <figure key={i} className="overflow-hidden rounded-lg border border-[#d4dde6] bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" className="w-full" />
                {(locale === "fr" ? img.captionFr : img.captionEn) && (
                  <figcaption className="px-4 py-3 text-sm text-[#495867]">
                    {locale === "fr" ? img.captionFr : img.captionEn}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        </section>
      )}

      <div className="mt-10">
        <Link href="/blog" className="text-sm font-medium text-[#495867] hover:underline">
          ← {t("article.back")}
        </Link>
      </div>
    </article>
  );
}

export type { ArticlePost };
