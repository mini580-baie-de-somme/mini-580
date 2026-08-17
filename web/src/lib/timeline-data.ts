/** Timeline view-model — pure helpers (client + server safe). */

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
  posts: { post: TimelinePost }[];
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

/** Posts linked to milestone whose publishedAt falls within [start, end] (inclusive). */
export function postsInMilestoneWindow(
  milestone: TimelineMilestone,
  publishedOnly = true
): MilestoneArticleStep[] {
  const start = toDate(milestone.milestoneDate);
  if (!start) return [];
  const end = toDate(milestone.endDate);
  const startDay = startOfDay(start);
  const endDay = end ? startOfDay(end) : null;

  const steps: MilestoneArticleStep[] = [];
  for (const link of milestone.posts) {
    const p = link.post;
    if (publishedOnly && p.status !== "PUBLISHED") continue;
    const pub = toDate(p.publishedAt);
    if (!pub) continue;
    const pubDay = startOfDay(pub);
    if (pubDay < startDay) continue;
    if (endDay && pubDay > endDay) continue;
    steps.push({ post: p, date: pub });
  }
  steps.sort((a, b) => a.date.getTime() - b.date.getTime());
  return steps;
}

export function buildMilestoneBlocks(
  milestones: TimelineMilestone[]
): TimelineMilestoneBlock[] {
  return milestones
    .map((m) => {
      const start = toDate(m.milestoneDate);
      if (!start) return null;
      const end = toDate(m.endDate);
      const steps = postsInMilestoneWindow(m);
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
  posts: TimelinePost[]
): TimelineStandalonePost[] {
  return posts
    .filter((p) => p.status === "PUBLISHED" && p.publishedAt)
    .map((p) => ({
      post: p,
      date: toDate(p.publishedAt)!,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Bar width % within a timeline range (for Gantt-style visuals). */
export function barPositionPercent(
  date: Date,
  rangeStart: Date,
  rangeEnd: Date
): number {
  const total = rangeEnd.getTime() - rangeStart.getTime();
  if (total <= 0) return 0;
  return Math.min(
    100,
    Math.max(0, ((date.getTime() - rangeStart.getTime()) / total) * 100)
  );
}

export function barWidthPercent(
  start: Date,
  end: Date,
  rangeStart: Date,
  rangeEnd: Date
): number {
  const left = barPositionPercent(start, rangeStart, rangeEnd);
  const right = barPositionPercent(end, rangeStart, rangeEnd);
  return Math.max(2, right - left);
}
