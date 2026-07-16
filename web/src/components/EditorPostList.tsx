"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { HullId } from "@/lib/types";
import { HullBadgeList } from "./HullBadge";

type EditorPostListItem = {
  id: string;
  slug: string;
  titleFr: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  updatedAt: string;
  hulls: { hull: HullId }[];
  onProd?: boolean;
};

export function EditorPostList({
  posts,
  isTestEnv = false,
}: {
  posts: EditorPostListItem[];
  isTestEnv?: boolean;
}) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  async function archive(id: string, archived: boolean) {
    const res = await fetch(`/api/posts/${id}/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Échec archivage");
      return;
    }
    router.refresh();
  }

  async function remove(id: string, title: string) {
    if (!confirm(`Supprimer définitivement « ${title} » ?`)) return;
    const res = await fetch(`/api/posts/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Échec suppression");
      return;
    }
    router.refresh();
  }

  async function publishToProd(id: string) {
    if (!confirm("Publier cet article sur PROD ?")) return;
    const res = await fetch("/api/sync/publish-to-prod", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: id, publish: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error ?? "Échec publication PROD");
      return;
    }
    alert("Publié sur PROD");
    router.refresh();
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-[#0D131A]">Éditeur</h1>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/editeur/jalons"
            className="rounded-md border border-[#d4dde6] px-4 py-2 text-sm text-[#495867] hover:bg-[#f4f7fa]"
          >
            Jalons
          </Link>
          <Link
            href="/editeur/sync"
            className="rounded-md border border-[#d4dde6] px-4 py-2 text-sm text-[#495867] hover:bg-[#f4f7fa]"
          >
            Sync TEST ↔ PROD
          </Link>
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
              <th className="px-4 py-3 font-medium">Actions</th>
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
                        : post.status === "ARCHIVED"
                          ? "bg-slate-200 text-slate-700"
                          : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {post.status === "PUBLISHED"
                      ? "Publié"
                      : post.status === "ARCHIVED"
                        ? "Archivé"
                        : "Brouillon"}
                  </span>
                </td>
                <td className="hidden px-4 py-3 text-[#495867] md:table-cell">
                  {new Date(post.updatedAt).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {isTestEnv && post.onProd === false && post.status !== "ARCHIVED" && (
                      <button
                        type="button"
                        onClick={() => void publishToProd(post.id)}
                        className="text-xs text-emerald-700 hover:underline"
                      >
                        Publier PROD
                      </button>
                    )}
                    {post.status === "ARCHIVED" ? (
                      <button
                        type="button"
                        onClick={() => void archive(post.id, false)}
                        className="text-xs text-[#495867] hover:underline"
                      >
                        Désarchiver
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void archive(post.id, true)}
                        className="text-xs text-[#495867] hover:underline"
                      >
                        Archiver
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void remove(post.id, post.titleFr)}
                      className="text-xs text-red-700 hover:underline"
                    >
                      Supprimer
                    </button>
                  </div>
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
