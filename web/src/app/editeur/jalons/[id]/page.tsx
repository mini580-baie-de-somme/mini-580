import { notFound, redirect } from "next/navigation";
import { MilestoneConsultation } from "@/components/MilestoneConsultation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSyncEnv, isSyncConfigured, peerFetch } from "@/lib/sync-crypto";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const milestone = await prisma.milestone.findUnique({ where: { id } });
  return { title: milestone ? `Jalon : ${milestone.titleFr}` : "Jalon" };
}

export default async function JalonConsultationPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/connexion");

  const { id } = await params;
  const milestone = await prisma.milestone.findUnique({ where: { id } });
  if (!milestone) notFound();

  const isTestEnv = getSyncEnv() === "test";
  let onProd: boolean | undefined;

  if (isTestEnv && isSyncConfigured()) {
    try {
      const res = await peerFetch("/api/sync/peer/export?resource=milestones", "export");
      if (res.ok) {
        const peer = (await res.json()) as Array<{ id: string }>;
        onProd = peer.some((m) => m.id === milestone.id);
      }
    } catch {
      // peer unreachable
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <MilestoneConsultation
        milestone={{
          ...milestone,
          milestoneDate: milestone.milestoneDate.toISOString(),
          endDate: milestone.endDate?.toISOString() ?? null,
        }}
        isTestEnv={isTestEnv}
        onProd={onProd}
      />
    </div>
  );
}
