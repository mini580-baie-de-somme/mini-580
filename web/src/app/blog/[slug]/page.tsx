import { notFound, permanentRedirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { findRelatedPosts, postInclude, withLegacyImages } from "@/lib/posts";
import { prepareArticleMediaPageData } from "@/lib/article-media-page";
import { ArticleView } from "@/components/ArticleView";
import { resolveSlugRedirect } from "@/lib/slug-history";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const resolved = await resolveSlugRedirect("post", slug);
  const canonicalSlug = resolved?.canonicalSlug ?? slug;
  const post = await prisma.post.findFirst({
    where: { slug: canonicalSlug, status: "PUBLISHED" },
  });
  if (!post) return { title: "Article" };
  return {
    title: post.titleFr,
    description: post.excerptFr,
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const resolved = await resolveSlugRedirect("post", slug);
  if (!resolved) notFound();

  if (resolved.redirectPath) {
    permanentRedirect(resolved.redirectPath);
  }

  const post = await prisma.post.findFirst({
    where: { slug: resolved.canonicalSlug, status: "PUBLISHED" },
    include: postInclude,
  });

  if (!post) notFound();

  const relatedPosts = await findRelatedPosts(post, 3);
  const mediaPage = await prepareArticleMediaPageData({
    id: post.id,
    coverImageUrl: post.coverImageUrl,
    bodyFr: post.bodyFr,
    bodyEn: post.bodyEn,
    mediaLinks: post.mediaLinks,
  });

  return (
    <div className="mx-auto w-full px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-14">
      <ArticleView
        post={withLegacyImages(post)}
        relatedPosts={relatedPosts}
        mediaPage={mediaPage}
      />
    </div>
  );
}
