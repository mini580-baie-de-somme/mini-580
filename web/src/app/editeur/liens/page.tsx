import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ExternalLinkManager } from "@/components/ExternalLinkManager";

export const metadata = {
  title: "Liens externes",
};

export default async function ExternalLinksPage() {
  const session = await getSession();
  if (!session) redirect("/connexion");

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <ExternalLinkManager />
    </div>
  );
}
