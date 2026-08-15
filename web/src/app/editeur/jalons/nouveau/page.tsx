import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { MilestoneEditorForm } from "@/components/MilestoneEditorForm";
import { emptyMilestoneForm } from "@/components/milestone-types";

export const metadata = {
  title: "Nouveau jalon",
};

export default async function NouveauJalonPage() {
  const session = await getSession();
  if (!session) redirect("/connexion");

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <MilestoneEditorForm
        mode="create"
        initialForm={emptyMilestoneForm()}
        backHref="/editeur/jalons"
        title="Nouveau jalon"
      />
    </div>
  );
}
