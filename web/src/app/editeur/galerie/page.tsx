import { Suspense } from "react";
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
    <div className="mx-auto max-w-6xl px-3 py-5 sm:px-6 sm:py-10 lg:py-12">
      <Suspense fallback={<p className="text-sm text-[#495867]">…</p>}>
        <MediaLibraryManager />
      </Suspense>
    </div>
  );
}
