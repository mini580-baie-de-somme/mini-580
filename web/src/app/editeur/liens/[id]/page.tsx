import { notFound, redirect } from "next/navigation";
import { ExternalLinkConsultation } from "@/components/ExternalLinkConsultation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { findPostsReferencingExternalLink } from "@/lib/external-links";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const link = await prisma.externalLink.findUnique({ where: { id } });
  return { title: link ? `Lien : ${link.labelFr || link.labelEn || id}` : "Lien externe" };
}

export default async function LienConsultationPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/connexion");

  const { id } = await params;
  const link = await prisma.externalLink.findUnique({ where: { id } });
  if (!link) notFound();

  const references = await findPostsReferencingExternalLink(id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <ExternalLinkConsultation
        link={{
          id: link.id,
          labelFr: link.labelFr,
          labelEn: link.labelEn,
          url: link.url,
          urlFr: link.urlFr,
          urlEn: link.urlEn,
          createdAt: link.createdAt.toISOString(),
          referencedByPostIds: references.map((p) => p.id),
        }}
        references={references}
      />
    </div>
  );
}
