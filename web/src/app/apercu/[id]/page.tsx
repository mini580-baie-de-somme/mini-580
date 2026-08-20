import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { prepareArticleMediaPageData } from "@/lib/article-media-page";
import { postInclude, withLegacyImages } from "@/lib/posts";
import { PreviewArticle } from "@/components/PreviewArticle";

type PageProps = { params: Promise<{ id: string }> };

export const metadata = {
  title: "Aperçu",
};

export default async function ApercuPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/connexion");

  const { id } = await params;
  const post = await prisma.post.findUnique({
    where: { id },
    include: postInclude,
  });

  if (!post) notFound();

  const legacy = withLegacyImages(post);
  const mediaPage = await prepareArticleMediaPageData({
    id: post.id,
    coverImageUrl: post.coverImageUrl,
    bodyFr: post.bodyFr,
    bodyEn: post.bodyEn,
    mediaLinks: post.mediaLinks,
  });

  return (
    <div className="mx-auto w-full px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-14">
      <PreviewArticle
        post={{
          ...legacy,
          publishedAt: legacy.publishedAt?.toISOString() ?? null,
        }}
        mediaPage={mediaPage}
      />
    </div>
  );
}
