"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { useLocale } from "./LocaleProvider";
import { EditorListCount } from "./EditorListCount";
import { EditorListSearch } from "./EditorListSearch";
import { EditorPageHeader, editorHeaderBtnPrimary, editorHeaderBtnSecondary } from "./EditorPageHeader";
import { displayExternalLinkUrl, type ExternalLinkRecord } from "./external-link-types";
import { useEditorInfiniteList } from "./useEditorInfiniteList";

export function ExternalLinkManager() {
  const { t } = useLocale();
  const router = useRouter();
  const [q, setQ] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    return params.toString();
  }, [q]);

  const {
    items,
    total,
    totalAll,
    loading,
    loadingMore,
    error,
    sentinelRef,
  } = useEditorInfiniteList<ExternalLinkRecord>({
    endpoint: "/api/external-links",
    queryString,
  });

  const onSearch = useCallback((next: string) => setQ(next), []);

  return (
    <div className="space-y-6">
      <EditorPageHeader
        title={t("externalLinks.title")}
        subtitle={t("externalLinks.subtitle")}
        actions={
          <>
            <Link href="/editeur" className={editorHeaderBtnSecondary()}>
              ← {t("nav.editor")}
            </Link>
            <Link href="/editeur/liens/nouveau" className={editorHeaderBtnPrimary()}>
              {t("externalLinks.new")}
            </Link>
          </>
        }
      />

      {error ? (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">
          {error === "LOAD_FAILED" ? t("list.loadError") : error}
        </p>
      ) : null}

      <EditorListSearch
        value={q}
        placeholder={t("externalLinks.search")}
        submitLabel={t("list.search")}
        onSubmit={onSearch}
      />

      {!loading ? (
        <EditorListCount
          total={total}
          totalAll={totalAll}
          filtered={Boolean(q)}
          totalLabel={t("list.count")}
          filteredLabel={t("list.countFiltered")}
        />
      ) : null}

      {loading ? (
        <p className="text-sm text-[#495867]">{t("editor.loading")}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[#d4dde6] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#d4dde6] bg-[#f4f7fa]">
              <tr>
                <th className="px-4 py-3 font-medium">{t("externalLinks.colLabel")}</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">
                  {t("externalLinks.colUrl")}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((link) => (
                <tr
                  key={link.id}
                  className="cursor-pointer border-b border-[#eef3f7] last:border-0 hover:bg-[#f8fafc]"
                  onClick={() => router.push(`/editeur/liens/${link.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#0D131A]">{link.labelFr || "—"}</div>
                    <div className="text-xs text-[#495867]">{link.labelEn || "—"}</div>
                  </td>
                  <td className="hidden max-w-xs truncate px-4 py-3 text-[#495867] sm:table-cell">
                    {displayExternalLinkUrl(link)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-[#495867]">{t("externalLinks.empty")}</p>
          ) : null}
        </div>
      )}

      <div ref={sentinelRef} className="h-4" aria-hidden />
      {loadingMore ? (
        <p className="mt-2 text-center text-sm text-[#495867]">{t("list.loadingMore")}</p>
      ) : null}
    </div>
  );
}
