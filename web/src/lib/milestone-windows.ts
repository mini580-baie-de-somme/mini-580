/** Date-window helpers — articles belong to jalons via publishedAt only. */

import type { Prisma } from "@/generated/prisma/client";
import { isPostInMilestoneWindow, type TimelinePost } from "@/lib/timeline-data";

export type MilestoneWindow = {
  id: string;
  slug: string;
  titleFr: string;
  titleEn: string;
  milestoneDate: Date;
  endDate: Date | null;
};

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Prisma filter: post.publishedAt within milestone [start, end] (inclusive, day granularity). */
export function publishedAtRangeForMilestone(m: {
  milestoneDate: Date;
  endDate: Date | null;
}): Prisma.PostWhereInput {
  const start = startOfDay(m.milestoneDate);
  if (!m.endDate) {
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return { publishedAt: { gte: start, lte: end } };
  }
  const endDay = startOfDay(m.endDate);
  endDay.setHours(23, 59, 59, 999);
  return { publishedAt: { gte: start, lte: endDay } };
}

/** Milestones whose date window contains the post's publishedAt. */
export function milestonesForPostPublishedAt(
  post: Pick<TimelinePost, "publishedAt" | "status">,
  milestones: MilestoneWindow[],
  publishedOnly = false
): MilestoneWindow[] {
  if (!post.publishedAt) return [];
  return milestones.filter((m) =>
    isPostInMilestoneWindow(post, m, publishedOnly)
  );
}

/** When a jalon is named but no date is set, default publishedAt to the milestone start. */
export function publishedAtForNamedMilestone(
  publishedAt: Date | null,
  milestone: Pick<MilestoneWindow, "milestoneDate">
): Date {
  if (publishedAt) return publishedAt;
  return milestone.milestoneDate;
}
