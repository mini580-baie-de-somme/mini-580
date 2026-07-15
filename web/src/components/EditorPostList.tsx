"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { HullId } from "@/lib/types";
import { HullBadgeList } from "./HullBadge";

type EditorPostListItem = {
  id: string;
  slug: string;
  titleFr: string;
  status: "DRAFT" | "PUBLISHED";
  updatedAt: string;
  hulls: { hull: HullId }[];
};

export function EditorPostList({ posts }: { posts: EditorPostListItem[] }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-[#0D131A]">Éditeur</h1>
        <div className="flex gap-2">
          <Link
            href="/editeur/nouveau"
            className="rounded-md bg-[#495867] px-4 py-2 text-sm text-white hover:bg-[#3a4654]"
          >
            Nouvel article
          </Link>
          <button
            type="button"
            onClick={logout}
            className="rounded-md border border-[#d4dde6] px-4 py-2 text-sm text-[#495867]"
          >
            Déconnexion
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-[#d4dde6] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[#d4dde6] bg-[#f4f7fa]">
            <tr>
              <th className="px-4 py-3 font-medium">Titre</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Coques</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Modifié</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id} className="border-b border-[#eef3f7] last:border-0">
                <td className="px-4 py-3">
                  <Link
                    href={`/editeur/${post.id}`}
                    className="font-medium text-[#0D131A] hover:text-[#495867]"
                  >
                    {post.titleFr}
                  </Link>
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  <HullBadgeList hulls={post.hulls} />
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      post.status === "PUBLISHED"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {post.status === "PUBLISHED" ? "Publié" : "Brouillon"}
                  </span>
                </td>
                <td className="hidden px-4 py-3 text-[#495867] md:table-cell">
                  {new Date(post.updatedAt).toLocaleDateString("fr-FR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {posts.length === 0 && (
          <p className="px-4 py-8 text-center text-[#495867]">Aucun article.</p>
        )}
      </div>
    </div>
  );
}
