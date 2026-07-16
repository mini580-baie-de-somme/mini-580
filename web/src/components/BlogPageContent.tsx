"use client";

import { Suspense } from "react";
import type { HullId } from "@/lib/types";
import { PostCard } from "./PostCard";
import { BlogFilters } from "./BlogFilters";
import { useLocale } from "./LocaleProvider";

type BlogPost = {
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

type FilterOptions = {
  themes: { slug: string; labelFr: string; labelEn: string }[];
  tags: { name: string; labelFr: string; labelEn: string }[];
};

export function BlogPageContent({
  posts,
  options,
}: {
  posts: BlogPost[];
  options: FilterOptions;
}) {
  const { t } = useLocale();

  return (
    <div className="blog-gradient min-h-full">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold text-[#0D131A]">{t("blog.title")}</h1>
        <p className="mt-2 text-[#495867]">{t("blog.subtitle")}</p>

        <div className="mt-8">
          <Suspense fallback={<div className="h-24 animate-pulse rounded-lg bg-white/50" />}>
            <BlogFilters options={options} />
          </Suspense>
        </div>

        {posts.length === 0 ? (
          <p className="mt-12 text-center text-[#495867]">{t("blog.empty")}</p>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
