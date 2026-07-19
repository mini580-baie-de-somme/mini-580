"use client";

import Link from "next/link";
import type { HullId } from "@/lib/types";
import { HullBadgeList } from "./HullBadge";
import { useLocale } from "./LocaleProvider";

type PostCardData = {
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

export function PostCard({ post }: { post: PostCardData }) {
  const { locale, t } = useLocale();
  const title = locale === "fr" ? post.titleFr : post.titleEn;
  const excerpt = locale === "fr" ? post.excerptFr : post.excerptEn;
  const date = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <article className="group flex flex-col overflow-hidden rounded-lg border border-[#d4dde6] bg-white shadow-sm transition hover:shadow-md">
      {post.coverImageUrl && (
        <Link
          href={`/blog/${post.slug}`}
          className="block aspect-[16/9] overflow-hidden bg-[#eef3f7]"
          aria-label={title}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.coverImageUrl}
            alt=""
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
          />
        </Link>
      )}
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <HullBadgeList hulls={post.hulls} />
          {post.themes.slice(0, 2).map(({ theme }) => (
            <span
              key={theme.slug}
              className="rounded bg-[#eef3f7] px-2 py-0.5 text-xs text-[#495867]"
            >
              {locale === "fr" ? theme.labelFr : theme.labelEn}
            </span>
          ))}
        </div>
        <h2 className="text-lg font-semibold text-[#0D131A] group-hover:text-[#495867]">
          <Link href={`/blog/${post.slug}`}>{title}</Link>
        </h2>
        {date && <time className="mt-1 text-xs text-[#495867]">{date}</time>}
        {excerpt && (
          <p className="mt-3 line-clamp-3 flex-1 text-sm text-[#495867]">{excerpt}</p>
        )}
        <Link
          href={`/blog/${post.slug}`}
          className="mt-4 text-sm font-medium text-[#495867] hover:underline"
        >
          {t("blog.readMore")}
        </Link>
      </div>
    </article>
  );
}
