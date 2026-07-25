"use client";

import Link from "next/link";
import { blogListPath } from "@/lib/blog-list-url";
import { useLocale } from "./LocaleProvider";

const chipClassName =
  "rounded bg-[#eef3f7] px-2 py-0.5 text-xs text-[#495867] transition hover:bg-[#d4dde6] hover:text-[#0D131A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#495867] focus-visible:ring-offset-1";

type ThemeChip = { slug: string; labelFr: string; labelEn: string };
type TagChip = { name: string; labelFr: string; labelEn: string };

export function BlogTaxonomyLinks({
  themes = [],
  tags = [],
  className = "",
}: {
  themes?: ThemeChip[];
  tags?: TagChip[];
  className?: string;
}) {
  const { locale, t } = useLocale();
  if (themes.length === 0 && tags.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`.trim()}>
      {themes.map((theme) => {
        const label = locale === "fr" ? theme.labelFr : theme.labelEn;
        return (
          <Link
            key={`theme-${theme.slug}`}
            href={blogListPath({ theme: theme.slug })}
            className={chipClassName}
            title={`${t("blog.theme")} ${label}`}
          >
            {label}
          </Link>
        );
      })}
      {tags.map((tag) => {
        const label = locale === "fr" ? tag.labelFr : tag.labelEn;
        return (
          <Link
            key={`tag-${tag.name}`}
            href={blogListPath({ tag: tag.name })}
            className={chipClassName}
            title={`${t("blog.tag")} ${label}`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
