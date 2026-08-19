import { redirect } from "next/navigation";
import { ExternalLinkEditorForm } from "@/components/ExternalLinkEditorForm";
import { emptyExternalLinkForm } from "@/components/external-link-types";
import { getSession } from "@/lib/auth";

export const metadata = {
  title: "Nouveau lien",
};

export default async function NouveauLienPage() {
  const session = await getSession();
  if (!session) redirect("/connexion");

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <ExternalLinkEditorForm
        mode="create"
        initialForm={emptyExternalLinkForm()}
        backHref="/editeur/liens"
        title="Nouveau lien"
      />
    </div>
  );
}
