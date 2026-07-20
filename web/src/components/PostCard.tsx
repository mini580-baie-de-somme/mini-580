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
    <article className="group flex h-full flex-col overflow-hidden rounded-lg border border-[#d4dde6] bg-white shadow-sm transition hover:shadow-md">
      <Link
        href={`/blog/${post.slug}`}
        className="block aspect-[16/9] shrink-0 overflow-hidden bg-[#eef3f7]"
        aria-label={title}
      >
        {post.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.coverImageUrl}
            alt=""
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
          />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center text-[#b0bcc8]"
            aria-hidden
          >
            <svg
              viewBox="0 0 24 24"
              className="h-10 w-10 opacity-60"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.25"
            >
              <rect x="3.5" y="5.5" width="17" height="13" rx="1.5" />
              <circle cx="9" cy="10.5" r="1.5" />
              <path d="m6.5 16.5 3.5-3.5 2.5 2.5 3-3.5 3.5 4.5" />
            </svg>
          </span>
        )}
      </Link>

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

        <h2 className="text-lg font-semibold leading-snug text-[#0D131A] group-hover:text-[#495867]">
          <Link href={`/blog/${post.slug}`}>{title}</Link>
        </h2>

        {date && (
          <time className="mt-1.5 block text-xs text-[#495867]">{date}</time>
        )}

        {excerpt ? (
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-[#495867]">
            {excerpt}
          </p>
        ) : null}

        <Link
          href={`/blog/${post.slug}`}
          className="mt-auto pt-4 text-sm font-medium text-[#495867] hover:underline"
        >
          {t("blog.readMore")}
        </Link>
      </div>
    </article>
  );
}
