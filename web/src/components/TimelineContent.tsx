"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useLocale } from "./LocaleProvider";
import { compareByDateThenTitle } from "@/lib/milestones";

type LinkedPost = {
  id: string;
  slug: string;
  titleFr: string;
  titleEn: string;
  status: string;
};

type MilestoneEntry = {
  id: string;
  titleFr: string;
  titleEn: string;
  descriptionFr: string;
  descriptionEn: string;
  milestoneDate: Date | string;
  posts: { post: LinkedPost }[];
};

type StandalonePost = {
  id: string;
  slug: string;
  titleFr: string;
  titleEn: string;
  publishedAt: Date | string;
};

type TimelineEntry =
  | { kind: "milestone"; date: Date | string; milestone: MilestoneEntry }
  | { kind: "post"; date: Date | string; post: StandalonePost };

export function TimelineContent({ entries }: { entries: TimelineEntry[] }) {
  const { locale, t } = useLocale();
  const dateLocale = locale === "fr" ? "fr-FR" : "en-GB";
  const lang = locale === "en" ? "en" : "fr";

  const sorted = useMemo(
    () =>
      [...entries].sort((a, b) => {
        const titleA =
          a.kind === "milestone"
            ? lang === "fr"
              ? a.milestone.titleFr
              : a.milestone.titleEn
            : lang === "fr"
              ? a.post.titleFr
              : a.post.titleEn;
        const titleB =
          b.kind === "milestone"
            ? lang === "fr"
              ? b.milestone.titleFr
              : b.milestone.titleEn
            : lang === "fr"
              ? b.post.titleFr
              : b.post.titleEn;
        return compareByDateThenTitle(
          { date: a.date, title: titleA },
          { date: b.date, title: titleB },
          lang
        );
      }),
    [entries, lang]
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-[#0D131A]">{t("timeline.title")}</h1>
      <p className="mt-2 text-[#495867]">{t("timeline.subtitle")}</p>

      <div className="relative mt-12">
        <div className="absolute left-4 top-0 h-full w-px bg-[#d4dde6] sm:left-6" />

        <ul className="space-y-10">
          {sorted.map((entry) => {
            const dateStr = new Date(entry.date).toLocaleDateString(dateLocale, {
              day: "numeric",
              month: "long",
              year: "numeric",
            });

            if (entry.kind === "milestone") {
              const m = entry.milestone;
              const title = locale === "fr" ? m.titleFr : m.titleEn;
              const description = locale === "fr" ? m.descriptionFr : m.descriptionEn;
              const linkedPosts = m.posts
                .map((pm) => pm.post)
                .filter((p) => p.status === "PUBLISHED");

              return (
                <li key={`m-${m.id}`} className="relative pl-12 sm:pl-16">
                  <span className="absolute left-2.5 top-1.5 h-3 w-3 rounded-full border-2 border-[#495867] bg-white sm:left-[1.125rem]" />
                  <time className="text-xs font-medium uppercase tracking-wide text-[#495867]">
                    {dateStr}
                  </time>
                  <h2 className="mt-1 text-lg font-semibold text-[#0D131A]">{title}</h2>
                  {description && (
                    <p className="mt-2 text-sm text-[#495867]">{description}</p>
                  )}
                  {linkedPosts.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {linkedPosts.map((p) => (
                        <li key={p.id}>
                          <Link
                            href={`/blog/${p.slug}`}
                            className="text-sm text-[#495867] hover:underline"
                          >
                            📄 {locale === "fr" ? p.titleFr : p.titleEn}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            }

            const p = entry.post;
            return (
              <li key={`p-${p.id}`} className="relative pl-12 sm:pl-16">
                <span className="absolute left-2.5 top-1.5 h-3 w-3 rounded-full bg-[#495867] sm:left-[1.125rem]" />
                <time className="text-xs font-medium uppercase tracking-wide text-[#495867]">
                  {dateStr}
                </time>
                <Link
                  href={`/blog/${p.slug}`}
                  className="mt-1 block text-lg font-medium text-[#0D131A] hover:text-[#495867]"
                >
                  {locale === "fr" ? p.titleFr : p.titleEn}
                </Link>
              </li>
            );
          })}
        </ul>

        {sorted.length === 0 && (
          <p className="text-center text-[#495867]">{t("timeline.empty")}</p>
        )}
      </div>
    </div>
  );
}
