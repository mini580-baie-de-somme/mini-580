import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { findRelatedPosts, postInclude, withLegacyImages } from "@/lib/posts";
import { ArticleView } from "@/components/ArticleView";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const post = await prisma.post.findFirst({
    where: { slug, status: "PUBLISHED" },
  });
  if (!post) return { title: "Article" };
  return {
    title: post.titleFr,
    description: post.excerptFr,
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await prisma.post.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: postInclude,
  });

  if (!post) notFound();

  const relatedPosts = await findRelatedPosts(post, 3);

  return (
    <div className="px-4 py-12 sm:px-6">
      <ArticleView
        post={withLegacyImages(post)}
        relatedPosts={relatedPosts}
      />
    </div>
  );
}
