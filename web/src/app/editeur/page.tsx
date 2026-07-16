import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { EditorPostList } from "@/components/EditorPostList";

export const metadata = {
  title: "Éditeur",
};

export default async function EditeurPage() {
  const session = await getSession();
  if (!session) redirect("/connexion");

  const [themes, tags] = await Promise.all([
    prisma.theme.findMany({ orderBy: { slug: "asc" } }),
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <Suspense fallback={<p className="text-[#495867]">…</p>}>
        <EditorPostList
          filterOptions={{
            themes: themes.map((t) => ({
              slug: t.slug,
              labelFr: t.labelFr,
              labelEn: t.labelEn,
            })),
            tags: tags.map((t) => ({
              name: t.name,
              labelFr: t.labelFr,
              labelEn: t.labelEn,
            })),
          }}
        />
      </Suspense>
    </div>
  );
}
