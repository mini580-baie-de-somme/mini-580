import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { SyncPanel } from "./SyncPanel";

export const metadata = {
  title: "Synchronisation",
};

export default async function SyncPage() {
  const session = await getSession();
  if (!session) redirect("/connexion");

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <SyncPanel />
    </div>
  );
}
