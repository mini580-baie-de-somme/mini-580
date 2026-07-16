import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { TagManager } from "@/components/TagManager";

export const metadata = {
  title: "Tags",
};

export default async function TagsPage() {
  const session = await getSession();
  if (!session) redirect("/connexion");

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <TagManager />
    </div>
  );
}
