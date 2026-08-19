"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useLocale } from "./LocaleProvider";
import { EditorListCount } from "./EditorListCount";
import { EditorListSearch } from "./EditorListSearch";
import { EditorPageHeader } from "./EditorPageHeader";
import { dispatchExternalLinkUpdated } from "@/lib/external-link-display";
import { useEditorInfiniteList } from "./useEditorInfiniteList";

type ExternalLink = {
  id: string;
  labelFr: string;
  labelEn: string;
  url: string | null;
  urlFr: string | null;
  urlEn: string | null;
};

type UrlMode = "single" | "bilingual";

type FormState = {
  labelFr: string;
  labelEn: string;
  urlMode: UrlMode;
  url: string;
  urlFr: string;
  urlEn: string;
};

const emptyForm: FormState = {
  labelFr: "",
  labelEn: "",
  urlMode: "single",
  url: "",
  urlFr: "",
  urlEn: "",
};

function displayUrl(link: ExternalLink): string {
  return link.url?.trim() || link.urlFr?.trim() || link.urlEn?.trim() || "—";
}

function formFromLink(link: ExternalLink): FormState {
  if (link.url?.trim()) {
    return {
      labelFr: link.labelFr,
      labelEn: link.labelEn,
      urlMode: "single",
      url: link.url,
      urlFr: "",
      urlEn: "",
    };
  }
  return {
    labelFr: link.labelFr,
    labelEn: link.labelEn,
    urlMode: "bilingual",
    url: "",
    urlFr: link.urlFr ?? "",
    urlEn: link.urlEn ?? "",
  };
}

function payloadFromForm(form: FormState) {
  const base = {
    labelFr: form.labelFr.trim(),
    labelEn: form.labelEn.trim(),
  };
  if (form.urlMode === "single") {
    return { ...base, url: form.url.trim() };
  }
  return { ...base, urlFr: form.urlFr.trim(), urlEn: form.urlEn.trim() };
}

function apiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object" && "formErrors" in error) {
    const formErrors = (error as { formErrors?: string[] }).formErrors;
    if (formErrors?.length) return formErrors.join(" · ");
    const fieldErrors = (error as { fieldErrors?: Record<string, string[]> }).fieldErrors;
    if (fieldErrors) {
      const messages = Object.values(fieldErrors).flat().filter(Boolean);
      if (messages.length) return messages.join(" · ");
    }
  }
  return fallback;
}

function isFormValid(form: FormState): boolean {
  if (!form.labelFr.trim() || !form.labelEn.trim()) return false;
  if (form.urlMode === "single") return Boolean(form.url.trim());
  return Boolean(form.urlFr.trim() && form.urlEn.trim());
}

export function ExternalLinkManager() {
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
  } = useEditorInfiniteList<ExternalLink>({
    endpoint: "/api/external-links",
    queryString,
  });

  function startCreate() {
    setEditingId("new");
    setForm(emptyForm);
  }

  function startEdit(link: ExternalLink) {
    setEditingId(link.id);
    setForm(formFromLink(link));
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const payload = payloadFromForm(form);
      const res =
        editingId === "new"
          ? await fetch("/api/external-links", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          : await fetch(`/api/external-links/${editingId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(apiErrorMessage(data.error, t("externalLinks.saveError")));
      }
      const savedId =
        editingId === "new" && data && typeof data === "object" && "id" in data
          ? String((data as { id: string }).id)
          : editingId !== "new"
            ? editingId
            : null;
      if (savedId) dispatchExternalLinkUpdated(savedId);
      cancelEdit();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("externalLinks.saveError"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(link: ExternalLink) {
    const label = locale === "fr" ? link.labelFr : link.labelEn;
    if (!confirm(t("externalLinks.deleteConfirm").replace("{name}", label))) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/external-links/${link.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        throw new Error(t("externalLinks.deleteInUse"));
      }
      if (!res.ok) {
        throw new Error(apiErrorMessage(data.error, t("externalLinks.deleteError")));
      }
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("externalLinks.deleteError"));
    } finally {
      setBusy(false);
    }
  }

  const onSearch = useCallback((next: string) => setQ(next), []);

  return (
    <div className="space-y-6">
      <EditorPageHeader
        title={t("externalLinks.title")}
        subtitle={t("externalLinks.subtitle")}
        actions={
          <>
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
              {t("externalLinks.new")}
            </button>
          </>
        }
      />

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">
          {error === "LOAD_FAILED" ? t("list.loadError") : error}
        </p>
      )}

      {editingId && (
        <div className="rounded-lg border border-[#d4dde6] bg-white p-4 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold text-[#0D131A]">
            {editingId === "new" ? t("externalLinks.new") : t("externalLinks.edit")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-[#495867]">{t("externalLinks.labelFr")}</span>
              <input
                className="w-full rounded-md border border-[#d4dde6] px-3 py-2"
                value={form.labelFr}
                onChange={(e) => setForm({ ...form, labelFr: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[#495867]">{t("externalLinks.labelEn")}</span>
              <input
                className="w-full rounded-md border border-[#d4dde6] px-3 py-2"
                value={form.labelEn}
                onChange={(e) => setForm({ ...form, labelEn: e.target.value })}
              />
            </label>
            <fieldset className="block text-sm sm:col-span-2">
              <legend className="mb-2 text-[#495867]">URL</legend>
              <div className="flex flex-wrap gap-4">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="urlMode"
                    checked={form.urlMode === "single"}
                    onChange={() => setForm({ ...form, urlMode: "single" })}
                  />
                  {t("externalLinks.urlModeSingle")}
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="urlMode"
                    checked={form.urlMode === "bilingual"}
                    onChange={() => setForm({ ...form, urlMode: "bilingual" })}
                  />
                  {t("externalLinks.urlModeBilingual")}
                </label>
              </div>
            </fieldset>
            {form.urlMode === "single" ? (
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-[#495867]">{t("externalLinks.url")}</span>
                <input
                  type="url"
                  className="w-full rounded-md border border-[#d4dde6] px-3 py-2"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://"
                />
              </label>
            ) : (
              <>
                <label className="block text-sm">
                  <span className="mb-1 block text-[#495867]">{t("externalLinks.urlFr")}</span>
                  <input
                    type="url"
                    className="w-full rounded-md border border-[#d4dde6] px-3 py-2"
                    value={form.urlFr}
                    onChange={(e) => setForm({ ...form, urlFr: e.target.value })}
                    placeholder="https://"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-[#495867]">{t("externalLinks.urlEn")}</span>
                  <input
                    type="url"
                    className="w-full rounded-md border border-[#d4dde6] px-3 py-2"
                    value={form.urlEn}
                    onChange={(e) => setForm({ ...form, urlEn: e.target.value })}
                    placeholder="https://"
                  />
                </label>
              </>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={busy || !isFormValid(form)}
              onClick={() => void save()}
              className="rounded-md bg-[#495867] px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {t("externalLinks.save")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={cancelEdit}
              className="rounded-md border border-[#d4dde6] px-4 py-2 text-sm"
            >
              {t("externalLinks.cancel")}
            </button>
          </div>
        </div>
      )}

      <EditorListSearch
        value={q}
        placeholder={t("externalLinks.search")}
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
                <th className="px-4 py-3 font-medium">{t("externalLinks.colLabel")}</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">
                  {t("externalLinks.colUrl")}
                </th>
                <th className="px-4 py-3 font-medium">{t("list.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((link) => (
                <tr
                  key={link.id}
                  className="cursor-pointer border-b border-[#eef3f7] last:border-0 hover:bg-[#f8fafc]"
                  onClick={() => startEdit(link)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#0D131A]">{link.labelFr}</div>
                    <div className="text-xs text-[#495867]">{link.labelEn}</div>
                  </td>
                  <td className="hidden max-w-xs truncate px-4 py-3 text-[#495867] sm:table-cell">
                    {displayUrl(link)}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => startEdit(link)}
                        className="text-xs text-[#495867] hover:underline"
                      >
                        {t("list.edit")}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void remove(link)}
                        className="text-xs text-red-700 hover:underline"
                      >
                        {t("externalLinks.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && (
            <p className="px-4 py-8 text-center text-[#495867]">{t("externalLinks.empty")}</p>
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
