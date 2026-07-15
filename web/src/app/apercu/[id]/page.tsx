import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { postInclude } from "@/lib/posts";
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <PreviewArticle
        post={{
          ...post,
          publishedAt: post.publishedAt?.toISOString() ?? null,
        }}
      />
    </div>
  );
}
