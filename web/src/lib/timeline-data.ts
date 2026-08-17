/** Timeline view-model — pure helpers (client + server safe). */

import {
  PROJECT_START_DATE,
  calendarDaysBetween,
  parseLocalISODate,
  startOfCalendarDay,
} from "@/lib/project-metrics";

export type TimelinePost = {
  id: string;
  slug: string;
  titleFr: string;
  titleEn: string;
  status: string;
  publishedAt: Date | string | null;
  workDays: number | null;
};

export type TimelineMilestone = {
  id: string;
  titleFr: string;
  titleEn: string;
  descriptionFr: string;
  descriptionEn: string;
  milestoneDate: Date | string;
  endDate: Date | string | null;
  workloadForecast: number | null;
};

export type MilestoneArticleStep = {
  post: TimelinePost;
  date: Date;
};

export type TimelineMilestoneBlock = {
  milestone: TimelineMilestone;
  start: Date;
  end: Date | null;
  isPunctual: boolean;
  steps: MilestoneArticleStep[];
  producedDays: number;
};

export type TimelineStandalonePost = {
  post: TimelinePost;
  date: Date;
};

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** True when today falls within [start, end] (inclusive, day granularity). Punctual → start day only. */
export function isMilestoneCurrent(
  start: Date,
  end: Date | null,
  isPunctual: boolean,
  now = new Date()
): boolean {
  const today = startOfDay(now);
  const startDay = startOfDay(start);
  if (isPunctual || !end) {
    return today.getTime() === startDay.getTime();
  }
  const endDay = startOfDay(end);
  return today >= startDay && today <= endDay;
}

/** True when post publishedAt falls within milestone [start, end] (inclusive, day granularity). Punctual → start day only. */
export function isPostInMilestoneWindow(
  post: Pick<TimelinePost, "publishedAt" | "status">,
  milestone: Pick<TimelineMilestone, "milestoneDate" | "endDate">,
  publishedOnly = true
): boolean {
  if (publishedOnly && post.status !== "PUBLISHED") return false;
  const pub = toDate(post.publishedAt);
  if (!pub) return false;
  const start = toDate(milestone.milestoneDate);
  if (!start) return false;
  const end = toDate(milestone.endDate);
  const pubDay = startOfDay(pub);
  const startDay = startOfDay(start);
  if (!end) {
    return pubDay.getTime() === startDay.getTime();
  }
  const endDay = startOfDay(end);
  return pubDay >= startDay && pubDay <= endDay;
}

/** Published posts whose publishedAt falls within milestone [start, end] (inclusive). */
export function postsInMilestoneWindow(
  milestone: TimelineMilestone,
  allPosts: TimelinePost[],
  publishedOnly = true
): MilestoneArticleStep[] {
  const steps: MilestoneArticleStep[] = [];
  for (const p of allPosts) {
    if (!isPostInMilestoneWindow(p, milestone, publishedOnly)) continue;
    steps.push({ post: p, date: toDate(p.publishedAt)! });
  }
  steps.sort((a, b) => a.date.getTime() - b.date.getTime());
  return steps;
}

export function buildMilestoneBlocks(
  milestones: TimelineMilestone[],
  allPosts: TimelinePost[]
): TimelineMilestoneBlock[] {
  return milestones
    .map((m) => {
      const start = toDate(m.milestoneDate);
      if (!start) return null;
      const end = toDate(m.endDate);
      const steps = postsInMilestoneWindow(m, allPosts);
      const producedDays = steps.reduce(
        (acc, s) => acc + (s.post.workDays ?? 0),
        0
      );
      return {
        milestone: m,
        start,
        end,
        isPunctual: !end,
        steps,
        producedDays,
      };
    })
    .filter((b): b is TimelineMilestoneBlock => b != null)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function standalonePublishedPosts(
  posts: TimelinePost[],
  milestones: TimelineMilestone[] = []
): TimelineStandalonePost[] {
  const inAnyWindow =
    milestones.length > 0
      ? new Set(
          buildMilestoneBlocks(milestones, posts).flatMap((b) =>
            b.steps.map((s) => s.post.id)
          )
        )
      : null;

  return posts
    .filter(
      (p) =>
        p.status === "PUBLISHED" &&
        p.publishedAt &&
        !(inAnyWindow?.has(p.id) ?? false)
    )
    .map((p) => ({
      post: p,
      date: toDate(p.publishedAt)!,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Project timeline axis: launch anchor → last milestone end (forecast). */
export function timelineRangeFromBlocks(
  blocks: TimelineMilestoneBlock[]
): { rangeStart: Date; rangeEnd: Date } {
  const rangeStart = startOfCalendarDay(parseLocalISODate(PROJECT_START_DATE));
  let rangeEnd = rangeStart;

  for (const block of blocks) {
    const candidate = startOfCalendarDay(block.end ?? block.start);
    if (candidate > rangeEnd) rangeEnd = candidate;
  }

  if (rangeEnd.getTime() <= rangeStart.getTime()) {
    const fallback = new Date(rangeStart);
    fallback.setDate(fallback.getDate() + 1);
    return { rangeStart, rangeEnd: fallback };
  }

  return { rangeStart, rangeEnd };
}

/** Position % on the project axis (calendar-day granularity). */
export function barPositionPercent(
  date: Date,
  rangeStart: Date,
  rangeEnd: Date
): number {
  const startDay = startOfCalendarDay(rangeStart);
  const endDay = startOfCalendarDay(rangeEnd);
  const totalDays = calendarDaysBetween(startDay, endDay);
  if (totalDays <= 0) return 0;

  const dateDay = startOfCalendarDay(date);
  const offsetDays = calendarDaysBetween(startDay, dateDay);
  return Math.min(100, Math.max(0, (offsetDays / totalDays) * 100));
}

/** Bar width % — end date is inclusive (covers the full end day). */
export function barWidthPercent(
  start: Date,
  end: Date,
  rangeStart: Date,
  rangeEnd: Date
): number {
  const left = barPositionPercent(start, rangeStart, rangeEnd);
  const endInclusive = startOfCalendarDay(end);
  endInclusive.setDate(endInclusive.getDate() + 1);
  const right = barPositionPercent(endInclusive, rangeStart, rangeEnd);
  return Math.max(2, right - left);
}
