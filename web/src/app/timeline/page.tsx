import { PostStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { TimelineContent } from "@/components/TimelineContent";
import { milestoneOrderBy } from "@/lib/milestones";

export const metadata = {
  title: "Timeline",
};

export default async function TimelinePage() {
  const milestones = await prisma.milestone.findMany({
    orderBy: milestoneOrderBy("fr"),
    include: {
      posts: {
        include: {
          post: {
            select: {
              id: true,
              slug: true,
              titleFr: true,
              titleEn: true,
              status: true,
              publishedAt: true,
            },
          },
        },
      },
    },
  });

  const standalonePosts = await prisma.post.findMany({
    where: {
      status: PostStatus.PUBLISHED,
      milestones: { none: {} },
    },
    orderBy: { publishedAt: "asc" },
    select: {
      id: true,
      slug: true,
      titleFr: true,
      titleEn: true,
      publishedAt: true,
    },
  });

  const entries = [
    ...milestones.map((m) => ({
      kind: "milestone" as const,
      date: m.milestoneDate,
      milestone: m,
    })),
    ...standalonePosts
      .filter((p): p is (typeof standalonePosts)[number] & { publishedAt: Date } =>
        p.publishedAt != null
      )
      .map((p) => ({
        kind: "post" as const,
        date: p.publishedAt,
        post: p,
      })),
  ];

  return <TimelineContent entries={entries} />;
}
