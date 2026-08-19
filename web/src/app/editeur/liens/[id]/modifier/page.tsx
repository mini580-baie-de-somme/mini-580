import { notFound, redirect } from "next/navigation";
import { ExternalLinkEditorForm } from "@/components/ExternalLinkEditorForm";
import { externalLinkToForm } from "@/components/external-link-types";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const link = await prisma.externalLink.findUnique({ where: { id } });
  const name = link?.labelFr || link?.labelEn || "Lien";
  return { title: link ? `${name} — Modification` : "Modifier le lien" };
}

export default async function LienModifierPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/connexion");

  const { id } = await params;
  const link = await prisma.externalLink.findUnique({ where: { id } });
  if (!link) notFound();

  const displayName = link.labelFr || link.labelEn || "Lien";

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <ExternalLinkEditorForm
        mode="edit"
        linkId={link.id}
        initialForm={externalLinkToForm({
          id: link.id,
          labelFr: link.labelFr,
          labelEn: link.labelEn,
          url: link.url,
          urlFr: link.urlFr,
          urlEn: link.urlEn,
        })}
        backHref={`/editeur/liens/${link.id}`}
        title={`${displayName} — (Modification)`}
      />
    </div>
  );
}
