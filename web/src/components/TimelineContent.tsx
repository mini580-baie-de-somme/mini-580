"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useLocale } from "./LocaleProvider";
import {
  buildMilestoneBlocks,
  standalonePublishedPosts,
  barPositionPercent,
  barWidthPercent,
  isMilestoneCurrent,
  type TimelineMilestone,
  type TimelinePost,
} from "@/lib/timeline-data";
import { elapsedProjectDays, sumWorkDays } from "@/lib/project-metrics";

type Props = {
  milestones: TimelineMilestone[];
  publishedPosts: TimelinePost[];
  allPostsForMetrics: { workDays: number | null }[];
};

export function TimelineContent({
  milestones,
  publishedPosts,
  allPostsForMetrics,
}: Props) {
  const { locale, t } = useLocale();
  const dateLocale = locale === "fr" ? "fr-FR" : "en-GB";
  const lang = locale === "en" ? "en" : "fr";

  const blocks = useMemo(
    () => buildMilestoneBlocks(milestones, publishedPosts),
    [milestones, publishedPosts]
  );
  const standalone = useMemo(
    () => standalonePublishedPosts(publishedPosts, milestones),
    [publishedPosts, milestones]
  );

  const elapsedDays = elapsedProjectDays();
  const totalProducedDays = sumWorkDays(allPostsForMetrics);

  const rangeStart = blocks[0]?.start ?? new Date();
  const rangeEnd =
    blocks.reduce<Date | null>((max, b) => {
      const candidate = b.end ?? b.start;
      return !max || candidate > max ? candidate : max;
    }, null) ?? new Date();

  function fmtDate(d: Date | string) {
    return new Date(d).toLocaleDateString(dateLocale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function titleForPost(p: TimelinePost) {
    return lang === "fr" ? p.titleFr : p.titleEn;
  }

  function titleForMilestone(m: TimelineMilestone) {
    return lang === "fr" ? m.titleFr : m.titleEn;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-[#0D131A]">{t("timeline.title")}</h1>
      <p className="mt-2 text-[#495867]">{t("timeline.subtitle")}</p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-[#d4dde6] bg-[#f4f7fa] px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-[#495867]">
            {t("timeline.metricElapsed")}
          </p>
          <p className="mt-1 text-2xl font-bold text-[#0D131A]">
            {elapsedDays}{" "}
            <span className="text-base font-normal text-[#495867]">
              {t("timeline.days")}
            </span>
          </p>
        </div>
        <div className="rounded-lg border border-[#d4dde6] bg-[#f4f7fa] px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-[#495867]">
            {t("timeline.metricProduced")}
          </p>
          <p className="mt-1 text-2xl font-bold text-[#0D131A]">
            {totalProducedDays}{" "}
            <span className="text-base font-normal text-[#495867]">
              {t("timeline.days")}
            </span>
          </p>
        </div>
      </div>

      <div className="relative mt-12 space-y-0">
        {blocks.length === 0 && standalone.length === 0 && (
          <p className="text-center text-[#495867]">{t("timeline.empty")}</p>
        )}

        {blocks.map((block, index) => {
          const m = block.milestone;
          const title = titleForMilestone(m);
          const description = lang === "fr" ? m.descriptionFr : m.descriptionEn;
          const forecast = m.workloadForecast;

          const barEnd = block.end ?? block.start;
          const barLeft = barPositionPercent(block.start, rangeStart, rangeEnd);
          const barWidth = block.isPunctual
            ? 3
            : barWidthPercent(block.start, barEnd, rangeStart, rangeEnd);
          const isCurrent = isMilestoneCurrent(
            block.start,
            block.end,
            block.isPunctual
          );

          const prevEnd = index > 0 ? (blocks[index - 1].end ?? blocks[index - 1].start) : null;
          const showGap =
            prevEnd &&
            block.start.getTime() > prevEnd.getTime() + 24 * 60 * 60 * 1000;

          return (
            <div key={m.id}>
              {showGap && (
                <div
                  className="my-6 border-t-2 border-dashed border-[#b8c5d0]"
                  aria-hidden
                />
              )}

              <article
                className={`relative pb-10 ${
                  isCurrent
                    ? "-mx-3 rounded-lg border border-[#495867] bg-[#eef3f7] px-3 pt-3 ring-1 ring-[#495867]/20"
                    : ""
                }`}
              >
                <div className="mb-3 h-3 rounded-full bg-[#eef3f7]">
                  <div
                    className={`h-full rounded-full ${
                      block.isPunctual
                        ? `mx-auto w-3 ${isCurrent ? "bg-[#0D131A]" : "bg-[#495867]"}`
                        : isCurrent
                          ? "bg-[#0D131A]"
                          : "bg-[#495867]"
                    }`}
                    style={
                      block.isPunctual
                        ? undefined
                        : {
                            marginLeft: `${barLeft}%`,
                            width: `${barWidth}%`,
                          }
                    }
                    title={
                      block.isPunctual
                        ? t("timeline.punctual")
                        : `${fmtDate(block.start)} → ${fmtDate(barEnd)}`
                    }
                  />
                </div>

                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <time className="text-xs font-medium uppercase tracking-wide text-[#495867]">
                    {fmtDate(block.start)}
                    {block.end ? ` → ${fmtDate(block.end)}` : ""}
                  </time>
                  {block.isPunctual && (
                    <span className="rounded-full bg-[#eef3f7] px-2 py-0.5 text-[10px] font-medium uppercase text-[#495867]">
                      {t("timeline.punctual")}
                    </span>
                  )}
                  {isCurrent && (
                    <span className="rounded-full bg-[#495867] px-2 py-0.5 text-[10px] font-medium uppercase text-white">
                      {t("timeline.current")}
                    </span>
                  )}
                </div>

                <h2 className="mt-1 text-lg font-semibold text-[#0D131A]">{title}</h2>

                {(forecast != null || block.producedDays > 0) && (
                  <p className="mt-1 text-sm text-[#495867]">
                    {forecast != null && (
                      <span>
                        {t("timeline.forecast")}: {forecast} {t("timeline.days")}
                      </span>
                    )}
                    {forecast != null && block.producedDays > 0 && " · "}
                    {block.producedDays > 0 && (
                      <span>
                        {t("timeline.produced")}: {block.producedDays}{" "}
                        {t("timeline.days")}
                      </span>
                    )}
                  </p>
                )}

                {description && (
                  <p className="mt-2 text-sm text-[#495867]">{description}</p>
                )}

                {block.steps.length > 0 && (
                  <div className="mt-5 rounded-lg border border-[#d4dde6] bg-[#f4f7fa]/90 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-[#495867]">
                        {t("timeline.milestoneSteps")}
                      </h3>
                      <span
                        className="rounded-full bg-[#495867]/10 px-2 py-0.5 text-[10px] font-medium text-[#495867]"
                        aria-hidden
                      >
                        {block.steps.length}
                      </span>
                    </div>
                    <ol className="space-y-2">
                      {block.steps.map(({ post, date }, stepIndex) => (
                        <li key={post.id}>
                          <Link
                            href={`/blog/${post.slug}`}
                            aria-label={`${t("timeline.step")} ${stepIndex + 1} — ${titleForPost(post)}`}
                            className="group flex gap-3 rounded-md border border-[#d4dde6] bg-white p-3 transition hover:border-[#495867] hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#495867]"
                          >
                            <span
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#495867] text-xs font-bold text-white"
                              aria-hidden
                            >
                              {stepIndex + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-medium uppercase tracking-wide text-[#6b7a8a]">
                                {t("timeline.step")} {stepIndex + 1}
                                <span className="mx-1.5 text-[#b8c5d0]">·</span>
                                <time dateTime={date.toISOString()}>{fmtDate(date)}</time>
                              </p>
                              <p className="mt-0.5 text-sm font-semibold leading-snug text-[#0D131A] group-hover:text-[#495867]">
                                {titleForPost(post)}
                              </p>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                {post.workDays != null && (
                                  <span className="rounded bg-[#eef3f7] px-1.5 py-0.5 text-[10px] font-medium text-[#495867]">
                                    {post.workDays} {t("timeline.days")}
                                  </span>
                                )}
                                <span className="text-xs font-medium text-[#495867] group-hover:underline">
                                  {t("timeline.readArticle")} →
                                </span>
                              </div>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </article>
            </div>
          );
        })}

        {standalone.length > 0 && (
          <section className="mt-8 border-t border-[#d4dde6] pt-8">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[#495867]">
              {t("timeline.standalonePosts")}
            </h3>
            <ul className="mt-4 space-y-4">
              {standalone.map(({ post, date }) => (
                <li key={post.id}>
                  <time className="text-xs text-[#495867]">{fmtDate(date)}</time>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="mt-0.5 block text-base font-medium text-[#0D131A] hover:text-[#495867]"
                  >
                    {titleForPost(post)}
                    {post.workDays != null && (
                      <span className="ml-2 text-xs font-normal text-[#495867]">
                        ({post.workDays} {t("timeline.days")})
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
