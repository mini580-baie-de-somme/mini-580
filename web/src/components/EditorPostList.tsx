"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { HullId } from "@/lib/types";
import { EDITOR_POSTS_PAGE_SIZE } from "@/lib/constants";
import { useLocale } from "./LocaleProvider";
import { HullBadgeList } from "./HullBadge";
import { EditorPostFilters } from "./EditorPostFilters";

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

type PostsPage = {
  items: EditorPostListItem[];
  total: number;
  limit: number;
  offset: number;
};

type FilterOptions = {
  themes: { slug: string; labelFr: string; labelEn: string }[];
  tags: { name: string; labelFr: string; labelEn: string }[];
};

export function EditorPostList({ filterOptions }: { filterOptions: FilterOptions }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale, t } = useLocale();
  const [posts, setPosts] = useState<EditorPostListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const fetchGenRef = useRef(0);

  const queryString = searchParams.toString();

  const fetchPage = useCallback(
    async (reset: boolean) => {
      const gen = ++fetchGenRef.current;
      if (reset) {
        setLoading(true);
        setError(null);
        offsetRef.current = 0;
      } else {
        setLoadingMore(true);
      }

      const params = new URLSearchParams(queryString);
      params.set("limit", String(EDITOR_POSTS_PAGE_SIZE));
      params.set("offset", String(reset ? 0 : offsetRef.current));

      try {
        const res = await fetch(`/api/posts?${params.toString()}`);
        if (!res.ok) throw new Error("fetch failed");
        const data = (await res.json()) as PostsPage;
        if (gen !== fetchGenRef.current) return;

        if (reset) {
          setPosts(data.items);
        } else {
          setPosts((prev) => [...prev, ...data.items]);
        }
        offsetRef.current = data.offset + data.items.length;
        setTotal(data.total);
      } catch {
        if (gen === fetchGenRef.current) {
          setError(t("editor.loadError"));
        }
      } finally {
        if (gen === fetchGenRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [queryString, t]
  );

  useEffect(() => {
    void fetchPage(true);
  }, [fetchPage]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0]?.isIntersecting &&
          !loading &&
          !loadingMore &&
          offsetRef.current < total
        ) {
          void fetchPage(false);
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchPage, loading, loadingMore, total]);

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

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-[#0D131A]">{t("editor.title")}</h1>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/editeur/jalons"
            className="rounded-md border border-[#d4dde6] px-4 py-2 text-sm text-[#495867] hover:bg-[#f4f7fa]"
          >
            {t("nav.milestones")}
          </Link>
          <Link
            href="/editeur/sync"
            className="rounded-md border border-[#d4dde6] px-4 py-2 text-sm text-[#495867] hover:bg-[#f4f7fa]"
          >
            {t("nav.sync")}
          </Link>
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
        <p className="mb-3 text-sm text-[#495867]">
          {t("editor.count").replace("{n}", String(total))}
        </p>
      )}

      <div className="overflow-hidden rounded-lg border border-[#d4dde6] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[#d4dde6] bg-[#f4f7fa]">
            <tr>
              <th className="px-4 py-3 font-medium">{t("editor.colTitle")}</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">{t("editor.colHulls")}</th>
              <th className="px-4 py-3 font-medium">{t("editor.colStatus")}</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">{t("editor.colUpdated")}</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr
                key={post.id}
                onClick={() => router.push(`/editeur/${post.id}`)}
                className="cursor-pointer border-b border-[#eef3f7] last:border-0 hover:bg-[#f8fafc]"
              >
                <td className="px-4 py-3">
                  <span className="font-medium text-[#0D131A]">
                    {locale === "fr" ? post.titleFr : post.titleEn || post.titleFr}
                  </span>
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
              </tr>
            ))}
          </tbody>
        </table>

        {loading && (
          <p className="px-4 py-8 text-center text-[#495867]">{t("editor.loading")}</p>
        )}
        {error && (
          <p className="px-4 py-8 text-center text-red-700">{error}</p>
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
