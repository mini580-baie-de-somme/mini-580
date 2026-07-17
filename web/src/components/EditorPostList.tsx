"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { HullId } from "@/lib/types";
import { isListFiltered } from "@/lib/editor-list";
import { useLocale } from "./LocaleProvider";
import { HullBadgeList } from "./HullBadge";
import { EditorPostFilters } from "./EditorPostFilters";
import { EditorListCount } from "./EditorListCount";
import { useEditorInfiniteList } from "./useEditorInfiniteList";

type EditorPostListItem = {
  id: string;
  slug: string;
  titleFr: string;
  titleEn: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  updatedAt: string;
  hulls: { hull: HullId }[];
  onProd?: boolean;
};

type FilterOptions = {
  themes: { slug: string; labelFr: string; labelEn: string }[];
  tags: { name: string; labelFr: string; labelEn: string }[];
};

const FILTER_KEYS = ["q", "status", "hull", "theme", "tag"];

export function EditorPostList({ filterOptions }: { filterOptions: FilterOptions }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale, t } = useLocale();
  const [busyId, setBusyId] = useState<string | null>(null);

  const queryString = searchParams.toString();
  const filtered = isListFiltered(searchParams, FILTER_KEYS);

  const {
    items: posts,
    total,
    totalAll,
    loading,
    loadingMore,
    error,
    setError,
    sentinelRef,
    reload,
  } = useEditorInfiniteList<EditorPostListItem>({
    endpoint: "/api/posts",
    queryString,
  });

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  function statusLabel(status: EditorPostListItem["status"]) {
    if (status === "PUBLISHED") return t("editor.status.published");
    if (status === "ARCHIVED") return t("editor.status.archived");
    return t("editor.status.draft");
  }

  function statusClass(status: EditorPostListItem["status"]) {
    if (status === "PUBLISHED") return "bg-emerald-100 text-emerald-800";
    if (status === "ARCHIVED") return "bg-slate-200 text-slate-700";
    return "bg-amber-100 text-amber-800";
  }

  async function remove(post: EditorPostListItem) {
    const title = locale === "fr" ? post.titleFr : post.titleEn || post.titleFr;
    if (!confirm(t("editor.deleteConfirm").replace("{title}", title))) return;
    setBusyId(post.id);
    setError(null);
    try {
      const res = await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(t("editor.deleteFailed"));
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("editor.deleteFailed"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-[#0D131A]">{t("editor.title")}</h1>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/editeur/nouveau"
            className="rounded-md bg-[#495867] px-4 py-2 text-sm text-white hover:bg-[#3a4654]"
          >
            {t("editor.newPost")}
          </Link>
          <button
            type="button"
            onClick={logout}
            className="rounded-md border border-[#d4dde6] px-4 py-2 text-sm text-[#495867]"
          >
            {t("editor.logout")}
          </button>
        </div>
      </div>

      <EditorPostFilters options={filterOptions} />

      {!loading && !error && (
        <EditorListCount
          total={total}
          totalAll={totalAll}
          filtered={filtered}
          totalLabel={t("list.count")}
          filteredLabel={t("list.countFiltered")}
        />
      )}

      <div className="overflow-hidden rounded-lg border border-[#d4dde6] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[#d4dde6] bg-[#f4f7fa]">
            <tr>
              <th className="px-4 py-3 font-medium">{t("editor.colTitle")}</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">{t("editor.colHulls")}</th>
              <th className="px-4 py-3 font-medium">{t("editor.colStatus")}</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">{t("editor.colUpdated")}</th>
              <th className="px-4 py-3 font-medium">{t("list.colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => {
              const title =
                locale === "fr" ? post.titleFr : post.titleEn || post.titleFr;
              const href = `/editeur/${post.id}`;

              return (
                <tr
                  key={post.id}
                  className="cursor-pointer border-b border-[#eef3f7] last:border-0 hover:bg-[#f8fafc]"
                  onClick={() => router.push(href)}
                >
                  <td className="px-4 py-3 font-medium text-[#0D131A]">
                    {title}
                    {post.onProd === false && (
                      <span className="ml-2 rounded bg-orange-100 px-1.5 py-0.5 text-[10px] text-orange-800">
                        {t("editor.notOnProd")}
                      </span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <HullBadgeList hulls={post.hulls} />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs ${statusClass(post.status)}`}>
                      {statusLabel(post.status)}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-[#495867] md:table-cell">
                    {new Date(post.updatedAt).toLocaleDateString(
                      locale === "fr" ? "fr-FR" : "en-GB"
                    )}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={href}
                        className="text-xs text-[#495867] hover:underline"
                      >
                        {t("list.edit")}
                      </Link>
                      <button
                        type="button"
                        disabled={busyId === post.id}
                        onClick={() => void remove(post)}
                        className="text-xs text-red-700 hover:underline disabled:opacity-50"
                      >
                        {t("editor.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {loading && (
          <p className="px-4 py-8 text-center text-[#495867]">{t("editor.loading")}</p>
        )}
        {error && (
          <p className="px-4 py-8 text-center text-red-700">{t("editor.loadError")}</p>
        )}
        {!loading && !error && posts.length === 0 && (
          <p className="px-4 py-8 text-center text-[#495867]">{t("editor.empty")}</p>
        )}
      </div>

      <div ref={sentinelRef} className="h-4" aria-hidden />
      {loadingMore && (
        <p className="mt-2 text-center text-sm text-[#495867]">{t("editor.loadingMore")}</p>
      )}
    </div>
  );
}
