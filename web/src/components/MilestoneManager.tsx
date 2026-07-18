"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "./LocaleProvider";
import { EditorListCount } from "./EditorListCount";
import { EditorListSearch } from "./EditorListSearch";
import { useEditorInfiniteList } from "./useEditorInfiniteList";

type Milestone = {
  id: string;
  slug: string;
  titleFr: string;
  titleEn: string;
  descriptionFr: string;
  descriptionEn: string;
  milestoneDate: string;
};

type FormState = {
  titleFr: string;
  titleEn: string;
  descriptionFr: string;
  descriptionEn: string;
  milestoneDate: string;
  slug: string;
};

const emptyForm: FormState = {
  titleFr: "",
  titleEn: "",
  descriptionFr: "",
  descriptionEn: "",
  milestoneDate: new Date().toISOString().slice(0, 10),
  slug: "",
};

function toDateInput(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

export function MilestoneManager({ isTestEnv = false }: { isTestEnv?: boolean }) {
  const { locale, t } = useLocale();
  const [q, setQ] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [prodIds, setProdIds] = useState<Set<string>>(new Set());

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
  } = useEditorInfiniteList<Milestone>({
    endpoint: "/api/milestones",
    queryString,
  });

  useEffect(() => {
    if (!isTestEnv || loading) return;
    let cancelled = false;
    void (async () => {
      try {
        const statusRes = await fetch("/api/sync/status");
        if (!statusRes.ok) return;
        const status = await statusRes.json();
        const onlyLocal = new Set(
          (status.milestones?.onlyLocal ?? []).map((m: { id: string }) => m.id)
        );
        if (cancelled) return;
        const onProd = new Set<string>();
        for (const m of items) {
          if (!onlyLocal.has(m.id)) onProd.add(m.id);
        }
        setProdIds(onProd);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isTestEnv, items, loading]);

  function startCreate() {
    setEditingId("new");
    setForm(emptyForm);
  }

  function startEdit(m: Milestone) {
    setEditingId(m.id);
    setForm({
      titleFr: m.titleFr,
      titleEn: m.titleEn,
      descriptionFr: m.descriptionFr,
      descriptionEn: m.descriptionEn,
      milestoneDate: toDateInput(m.milestoneDate),
      slug: m.slug,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        titleFr: form.titleFr.trim(),
        titleEn: form.titleEn.trim(),
        descriptionFr: form.descriptionFr,
        descriptionEn: form.descriptionEn,
        milestoneDate: new Date(form.milestoneDate).toISOString(),
        ...(form.slug.trim() ? { slug: form.slug.trim() } : {}),
      };

      const res =
        editingId === "new"
          ? await fetch("/api/milestones", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          : await fetch(`/api/milestones/${editingId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("list.loadError"));
      cancelEdit();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("list.loadError"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(m: Milestone) {
    const name = locale === "fr" ? m.titleFr : m.titleEn;
    if (!confirm(t("milestones.deleteConfirm").replace("{name}", name))) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/milestones/${m.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(t("list.loadError"));
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("list.loadError"));
    } finally {
      setBusy(false);
    }
  }

  async function publishToProd(m: Milestone) {
    if (!confirm(`Publier le jalon « ${m.titleFr} » sur PROD ?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sync/publish-milestone-to-prod", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestoneId: m.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Publication PROD impossible");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#0D131A]">{t("milestones.title")}</h1>
          <p className="mt-1 text-sm text-[#495867]">{t("milestones.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/editeur"
            className="rounded-md border border-[#d4dde6] px-3 py-2 text-sm text-[#495867]"
          >
            ← {t("nav.editor")}
          </Link>
          <Link
            href="/editeur/sync"
            className="rounded-md border border-[#d4dde6] px-3 py-2 text-sm text-[#495867]"
          >
            {t("nav.sync")}
          </Link>
          {isTestEnv && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void pullFromProd()}
              className="rounded-md border border-[#d4dde6] px-3 py-2 text-sm text-[#495867] hover:bg-[#f4f7fa] disabled:opacity-50"
            >
              {t("milestones.pullProd")}
            </button>
          )}
          <button
            type="button"
            disabled={busy || editingId !== null}
            onClick={startCreate}
            className="rounded-md bg-[#495867] px-3 py-2 text-sm text-white hover:bg-[#3a4654] disabled:opacity-50"
          >
            {t("milestones.new")}
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">
          {error === "LOAD_FAILED" ? t("list.loadError") : error}
        </p>
      )}

      {editingId && (
        <div className="rounded-lg border border-[#d4dde6] bg-white p-4 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold text-[#0D131A]">
            {editingId === "new" ? t("milestones.new") : t("milestones.edit")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-[#495867]">Titre FR</span>
              <input
                className="w-full rounded-md border border-[#d4dde6] px-3 py-2"
                value={form.titleFr}
                onChange={(e) => setForm({ ...form, titleFr: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[#495867]">Title EN</span>
              <input
                className="w-full rounded-md border border-[#d4dde6] px-3 py-2"
                value={form.titleEn}
                onChange={(e) => setForm({ ...form, titleEn: e.target.value })}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-[#495867]">Description FR</span>
              <textarea
                rows={3}
                className="w-full rounded-md border border-[#d4dde6] px-3 py-2"
                value={form.descriptionFr}
                onChange={(e) => setForm({ ...form, descriptionFr: e.target.value })}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-[#495867]">Description EN</span>
              <textarea
                rows={3}
                className="w-full rounded-md border border-[#d4dde6] px-3 py-2"
                value={form.descriptionEn}
                onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[#495867]">Date</span>
              <input
                type="date"
                className="w-full rounded-md border border-[#d4dde6] px-3 py-2"
                value={form.milestoneDate}
                onChange={(e) => setForm({ ...form, milestoneDate: e.target.value })}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-[#495867]">Slug (optionnel)</span>
              <input
                className="w-full rounded-md border border-[#d4dde6] px-3 py-2"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="auto depuis le titre EN"
              />
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={busy || !form.titleFr.trim() || !form.titleEn.trim()}
              onClick={() => void save()}
              className="rounded-md bg-[#495867] px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {t("milestones.save")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={cancelEdit}
              className="rounded-md border border-[#d4dde6] px-4 py-2 text-sm"
            >
              {t("milestones.cancel")}
            </button>
          </div>
        </div>
      )}

      <EditorListSearch
        value={q}
        placeholder={t("milestones.search")}
        submitLabel={t("list.search")}
        onSubmit={onSearch}
      />

      {!loading && (
        <EditorListCount
          total={total}
          totalAll={totalAll}
          filtered={Boolean(q)}
          totalLabel={t("list.count")}
          filteredLabel={t("list.countFiltered")}
        />
      )}

      {loading ? (
        <p className="text-sm text-[#495867]">{t("editor.loading")}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[#d4dde6] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#d4dde6] bg-[#f4f7fa]">
              <tr>
                <th className="px-4 py-3 font-medium">{t("milestones.colDate")}</th>
                <th className="px-4 py-3 font-medium">{t("milestones.colTitle")}</th>
                <th className="px-4 py-3 font-medium">{t("list.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr
                  key={m.id}
                  className="cursor-pointer border-b border-[#eef3f7] last:border-0 hover:bg-[#f8fafc]"
                  onClick={() => startEdit(m)}
                >
                  <td className="px-4 py-3 whitespace-nowrap text-[#495867]">
                    {new Date(m.milestoneDate).toLocaleDateString(
                      locale === "fr" ? "fr-FR" : "en-GB"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#0D131A]">{m.titleFr}</div>
                    <div className="text-xs text-[#495867]">{m.titleEn}</div>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => startEdit(m)}
                        className="text-xs text-[#495867] hover:underline"
                      >
                        {t("list.edit")}
                      </button>
                      {isTestEnv && !prodIds.has(m.id) && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void publishToProd(m)}
                          className="text-xs text-emerald-700 hover:underline"
                        >
                          {t("milestones.publishProd")}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void remove(m)}
                        className="text-xs text-red-700 hover:underline"
                      >
                        {t("milestones.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && (
            <p className="px-4 py-8 text-center text-[#495867]">{t("milestones.empty")}</p>
          )}
        </div>
      )}

      <div ref={sentinelRef} className="h-4" aria-hidden />
      {loadingMore && (
        <p className="mt-2 text-center text-sm text-[#495867]">{t("list.loadingMore")}</p>
      )}
    </div>
  );
}
