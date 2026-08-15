"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { useLocale } from "./LocaleProvider";
import { EditorListCount } from "./EditorListCount";
import { EditorListSearch } from "./EditorListSearch";
import { EditorPageHeader, editorHeaderBtnPrimary, editorHeaderBtnSecondary } from "./EditorPageHeader";
import { useEditorInfiniteList } from "./useEditorInfiniteList";
import { formatMilestoneDate, type MilestoneRecord } from "./milestone-types";

export function MilestoneManager({ isTestEnv = false }: { isTestEnv?: boolean }) {
  const { locale, t } = useLocale();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("locale", locale);
    return params.toString();
  }, [q, locale]);

  const {
    items,
    total,
    totalAll,
    loading,
    loadingMore,
    error,
    setError,
    sentinelRef,
    reload,
  } = useEditorInfiniteList<MilestoneRecord>({
    endpoint: "/api/milestones",
    queryString,
  });

  async function pullFromProd() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sync/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction: "pull" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Pull PROD impossible");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  const onSearch = useCallback((next: string) => setQ(next), []);
  const dateLocale = locale === "fr" ? "fr" : "en";

  return (
    <div className="space-y-6">
      <EditorPageHeader
        title={t("milestones.title")}
        subtitle={t("milestones.subtitle")}
        actions={
          <>
            <Link href="/editeur" className={editorHeaderBtnSecondary()}>
              ← {t("nav.editor")}
            </Link>
            <Link href="/editeur/sync" className={editorHeaderBtnSecondary()}>
              {t("nav.sync")}
            </Link>
            {isTestEnv ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void pullFromProd()}
                className={editorHeaderBtnSecondary()}
              >
                {t("milestones.pullProd")}
              </button>
            ) : null}
            <Link href="/editeur/jalons/nouveau" className={editorHeaderBtnPrimary()}>
              {t("milestones.new")}
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
        placeholder={t("milestones.search")}
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
                <th className="px-4 py-3 font-medium">{t("milestones.colDate")}</th>
                <th className="px-4 py-3 font-medium">{t("milestones.colTitle")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr
                  key={m.id}
                  className="cursor-pointer border-b border-[#eef3f7] last:border-0 hover:bg-[#f8fafc]"
                  onClick={() => router.push(`/editeur/jalons/${m.id}`)}
                >
                  <td className="px-4 py-3 whitespace-nowrap text-[#495867]">
                    <div>{formatMilestoneDate(m.milestoneDate, dateLocale)}</div>
                    {m.endDate ? (
                      <div className="text-xs text-[#64748b]">
                        {formatMilestoneDate(m.endDate, dateLocale)}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#0D131A]">{m.titleFr}</div>
                    <div className="text-xs text-[#495867]">{m.titleEn}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-[#495867]">{t("milestones.empty")}</p>
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
