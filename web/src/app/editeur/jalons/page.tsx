import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getSyncEnv } from "@/lib/sync-crypto";
import { MilestoneManager } from "@/components/MilestoneManager";

export const metadata = {
  title: "Jalons timeline",
};

export default async function JalonsPage() {
  const session = await getSession();
  if (!session) redirect("/connexion");

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <MilestoneManager isTestEnv={getSyncEnv() === "test"} />
    </div>
  );
}
