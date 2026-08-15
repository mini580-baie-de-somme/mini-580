import { notFound, redirect } from "next/navigation";
import { MilestoneEditorForm } from "@/components/MilestoneEditorForm";
import { milestoneToForm } from "@/components/milestone-types";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const milestone = await prisma.milestone.findUnique({ where: { id } });
  return {
    title: milestone ? `${milestone.titleFr} — Modification` : "Modifier le jalon",
  };
}

export default async function JalonModifierPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/connexion");

  const { id } = await params;
  const milestone = await prisma.milestone.findUnique({ where: { id } });
  if (!milestone) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <MilestoneEditorForm
        mode="edit"
        milestoneId={milestone.id}
        initialForm={milestoneToForm({
          ...milestone,
          milestoneDate: milestone.milestoneDate.toISOString(),
          endDate: milestone.endDate?.toISOString() ?? null,
        })}
        savedSlug={milestone.slug}
        backHref={`/editeur/jalons/${milestone.id}`}
        title={`${milestone.titleFr} — (Modification)`}
      />
    </div>
  );
}
