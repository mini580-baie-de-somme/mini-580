import { PostStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { postInclude } from "@/lib/posts";
import { HomePageContent } from "@/components/HomePageContent";

export default async function HomePage() {
  const latestPosts = await prisma.post.findMany({
    where: { status: PostStatus.PUBLISHED },
    include: postInclude,
    orderBy: { publishedAt: "desc" },
    take: 3,
  });

  return <HomePageContent latestPosts={latestPosts} />;
}
