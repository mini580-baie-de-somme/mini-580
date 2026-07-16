import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { postInclude } from "@/lib/posts";
import { PreviewArticle } from "@/components/PreviewArticle";

type PageProps = { params: Promise<{ token: string }> };

export const metadata = {
  title: "Aperçu partagé",
  robots: { index: false, follow: false },
};

export default async function SharedPreviewPage({ params }: PageProps) {
  const { token } = await params;
  const preview = await prisma.previewToken.findUnique({
    where: { token },
    include: { post: { include: postInclude } },
  });

  if (!preview || preview.expiresAt.getTime() < Date.now()) {
    notFound();
  }

  const post = preview.post;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="mb-6 text-sm text-[#495867]">
        Aperçu partagé (lien temporaire) — expire le{" "}
        {preview.expiresAt.toLocaleString("fr-FR")}
      </p>
      <PreviewArticle
        showEditorLink={false}
        post={{
          ...post,
          publishedAt: post.publishedAt?.toISOString() ?? null,
        }}
      />
    </div>
  );
}
