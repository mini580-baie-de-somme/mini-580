import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { MediaLibraryManager } from "@/components/MediaLibraryManager";

export const metadata = {
  title: "Galerie — médiathèque",
};

export default async function EditorGalleryPage() {
  const session = await getSession();
  if (!session) redirect("/connexion");

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <MediaLibraryManager />
    </div>
  );
}
