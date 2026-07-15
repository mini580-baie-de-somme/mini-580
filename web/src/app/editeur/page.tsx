import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { postInclude } from "@/lib/posts";
import { EditorPostList } from "@/components/EditorPostList";

export const metadata = {
  title: "Éditeur",
};

export default async function EditeurPage() {
  const session = await getSession();
  if (!session) redirect("/connexion");

  const posts = await prisma.post.findMany({
    include: postInclude,
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <EditorPostList
        posts={posts.map((p) => ({
          id: p.id,
          slug: p.slug,
          titleFr: p.titleFr,
          status: p.status,
          updatedAt: p.updatedAt.toISOString(),
          hulls: p.hulls,
        }))}
      />
    </div>
  );
}
