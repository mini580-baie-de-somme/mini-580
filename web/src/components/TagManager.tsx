"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useLocale } from "./LocaleProvider";
import { EditorListCount } from "./EditorListCount";
import { EditorListSearch } from "./EditorListSearch";
import { useEditorInfiniteList } from "./useEditorInfiniteList";

type Tag = {
  id: string;
  name: string;
  labelFr: string;
  labelEn: string;
};

type FormState = {
  labelFr: string;
  labelEn: string;
  name: string;
};

const emptyForm: FormState = {
  labelFr: "",
  labelEn: "",
  name: "",
};

export function TagManager() {
  const { locale, t } = useLocale();
  const [q, setQ] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);

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
    setError,
    sentinelRef,
    reload,
  } = useEditorInfiniteList<Tag>({
    endpoint: "/api/tags",
    queryString,
  });

  function startCreate() {
    setEditingId("new");
    setForm(emptyForm);
  }

  function startEdit(tag: Tag) {
    setEditingId(tag.id);
    setForm({
      labelFr: tag.labelFr,
      labelEn: tag.labelEn,
      name: tag.name,
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
        labelFr: form.labelFr.trim(),
        labelEn: form.labelEn.trim(),
        ...(form.name.trim() ? { name: form.name.trim() } : {}),
      };

      const res =
        editingId === "new"
          ? await fetch("/api/tags", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          : await fetch(`/api/tags/${editingId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("tags.saveError"));
      cancelEdit();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("tags.saveError"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(tag: Tag) {
    const label = locale === "fr" ? tag.labelFr : tag.labelEn;
    if (!confirm(t("tags.deleteConfirm").replace("{name}", label))) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tags/${tag.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(t("tags.deleteError"));
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("tags.deleteError"));
    } finally {
      setBusy(false);
    }
  }

  const onSearch = useCallback((next: string) => setQ(next), []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#0D131A]">{t("tags.title")}</h1>
          <p className="mt-1 text-sm text-[#495867]">{t("tags.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/editeur"
            className="rounded-md border border-[#d4dde6] px-3 py-2 text-sm text-[#495867]"
          >
            ← {t("nav.editor")}
          </Link>
          <button
            type="button"
            disabled={busy || editingId !== null}
            onClick={startCreate}
            className="rounded-md bg-[#495867] px-3 py-2 text-sm text-white hover:bg-[#3a4654] disabled:opacity-50"
          >
            {t("tags.new")}
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
            {editingId === "new" ? t("tags.new") : t("tags.edit")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-[#495867]">{t("tags.labelFr")}</span>
              <input
                className="w-full rounded-md border border-[#d4dde6] px-3 py-2"
                value={form.labelFr}
                onChange={(e) => setForm({ ...form, labelFr: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[#495867]">{t("tags.labelEn")}</span>
              <input
                className="w-full rounded-md border border-[#d4dde6] px-3 py-2"
                value={form.labelEn}
                onChange={(e) => setForm({ ...form, labelEn: e.target.value })}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-[#495867]">{t("tags.name")}</span>
              <input
                className="w-full rounded-md border border-[#d4dde6] px-3 py-2"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t("tags.nameHint")}
              />
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={busy || !form.labelFr.trim() || !form.labelEn.trim()}
              onClick={() => void save()}
              className="rounded-md bg-[#495867] px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {t("tags.save")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={cancelEdit}
              className="rounded-md border border-[#d4dde6] px-4 py-2 text-sm"
            >
              {t("tags.cancel")}
            </button>
          </div>
        </div>
      )}

      <EditorListSearch
        value={q}
        placeholder={t("tags.search")}
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
                <th className="px-4 py-3 font-medium">{t("tags.colLabel")}</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">{t("tags.colName")}</th>
                <th className="px-4 py-3 font-medium">{t("list.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((tag) => (
                <tr
                  key={tag.id}
                  className="cursor-pointer border-b border-[#eef3f7] last:border-0 hover:bg-[#f8fafc]"
                  onClick={() => startEdit(tag)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#0D131A]">{tag.labelFr}</div>
                    <div className="text-xs text-[#495867]">{tag.labelEn}</div>
                  </td>
                  <td className="hidden px-4 py-3 text-[#495867] sm:table-cell">{tag.name}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => startEdit(tag)}
                        className="text-xs text-[#495867] hover:underline"
                      >
                        {t("list.edit")}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void remove(tag)}
                        className="text-xs text-red-700 hover:underline"
                      >
                        {t("tags.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && (
            <p className="px-4 py-8 text-center text-[#495867]">{t("tags.empty")}</p>
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
