import { PostStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { TimelineContent } from "@/components/TimelineContent";
import { milestoneOrderBy } from "@/lib/milestones";

export const metadata = {
  title: "Timeline",
};

const postSelect = {
  id: true,
  slug: true,
  titleFr: true,
  titleEn: true,
  status: true,
  publishedAt: true,
  workDays: true,
} as const;

export default async function TimelinePage() {
  const milestones = await prisma.milestone.findMany({
    orderBy: milestoneOrderBy("fr"),
    include: {
      posts: {
        include: {
          post: { select: postSelect },
        },
      },
    },
  });

  const publishedPosts = await prisma.post.findMany({
    where: {
      status: PostStatus.PUBLISHED,
      publishedAt: { not: null },
    },
    orderBy: { publishedAt: "asc" },
    select: postSelect,
  });

  const allPostsForMetrics = await prisma.post.findMany({
    where: { status: PostStatus.PUBLISHED },
    select: { workDays: true },
  });

  return (
    <TimelineContent
      milestones={milestones}
      publishedPosts={publishedPosts}
      allPostsForMetrics={allPostsForMetrics}
    />
  );
}
