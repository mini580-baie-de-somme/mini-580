"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useLocale } from "./LocaleProvider";
import { EditorListCount } from "./EditorListCount";
import { EditorListSearch } from "./EditorListSearch";
import { useEditorInfiniteList } from "./useEditorInfiniteList";

type MediaKind = "IMAGE" | "DOCUMENT" | "VIDEO";

type MediaItem = {
  id: string;
  kind: MediaKind;
  mimeType: string;
  urlOrigin: string;
  urlPicto: string | null;
  urlMoyenne: string | null;
  titleFr: string;
  titleEn: string;
  descriptionFr: string;
  descriptionEn: string;
  posts?: { post: { id: string; titleFr: string; slug: string } }[];
};

type FormState = {
  titleFr: string;
  titleEn: string;
  descriptionFr: string;
  descriptionEn: string;
};

const emptyForm: FormState = {
  titleFr: "",
  titleEn: "",
  descriptionFr: "",
  descriptionEn: "",
};

const KIND_FILTERS: Array<"ALL" | MediaKind> = ["ALL", "IMAGE", "DOCUMENT", "VIDEO"];

export function MediaLibraryManager() {
  const { locale, t } = useLocale();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"ALL" | MediaKind>("ALL");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (kind !== "ALL") params.set("kind", kind);
    return params.toString();
  }, [q, kind]);

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
  } = useEditorInfiniteList<MediaItem>({
    endpoint: "/api/media-library",
    queryString,
  });

  function startCreate() {
    setEditingId("new");
    setForm(emptyForm);
    setFile(null);
  }

  function startEdit(m: MediaItem) {
    setEditingId(m.id);
    setForm({
      titleFr: m.titleFr,
      titleEn: m.titleEn,
      descriptionFr: m.descriptionFr,
      descriptionEn: m.descriptionEn,
    });
    setFile(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setFile(null);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (editingId === "new") {
        if (!file) throw new Error(t("media.fileRequired"));
        const fd = new FormData();
        fd.set("file", file);
        fd.set("titleFr", form.titleFr);
        fd.set("titleEn", form.titleEn);
        fd.set("descriptionFr", form.descriptionFr);
        fd.set("descriptionEn", form.descriptionEn);
        const res = await fetch("/api/media-library", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? t("media.saveError"));
      } else {
        const res = await fetch(`/api/media-library/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? t("media.saveError"));
        if (file) {
          const fd = new FormData();
          fd.set("file", file);
          const rep = await fetch(`/api/media-library/${editingId}/replace`, {
            method: "POST",
            body: fd,
          });
          if (!rep.ok) throw new Error(t("media.saveError"));
        }
      }
      cancelEdit();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("media.saveError"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(m: MediaItem) {
    const label = locale === "fr" ? m.titleFr || m.id : m.titleEn || m.id;
    const linked = m.posts?.length ?? 0;
    const msg =
      linked > 0
        ? t("media.deleteLinkedConfirm")
            .replace("{name}", label)
            .replace("{n}", String(linked))
        : t("media.deleteConfirm").replace("{name}", label);
    if (!confirm(msg)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/media-library/${m.id}?force=${linked > 0 ? "1" : "0"}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? t("media.deleteError"));
      }
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("media.deleteError"));
    } finally {
      setBusy(false);
    }
  }

  const onSearch = useCallback((next: string) => setQ(next), []);

  function kindLabel(k: MediaKind | "ALL") {
    if (k === "ALL") return t("media.kind.all");
    if (k === "IMAGE") return t("media.kind.image");
    if (k === "DOCUMENT") return t("media.kind.document");
    return t("media.kind.video");
  }

  function thumb(m: MediaItem) {
    if (m.kind === "IMAGE") {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={m.urlPicto || m.urlMoyenne || m.urlOrigin}
          alt=""
          className="h-10 w-10 rounded object-cover"
        />
      );
    }
    return (
      <span className="flex h-10 w-10 items-center justify-center rounded bg-[#eef3f7] text-[10px] font-semibold text-[#495867]">
        {m.kind === "DOCUMENT" ? "PDF" : "VID"}
      </span>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#0D131A]">{t("media.title")}</h1>
          <p className="mt-1 text-sm text-[#495867]">{t("media.subtitle")}</p>
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
            {t("media.new")}
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
            {editingId === "new" ? t("media.new") : t("media.edit")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-[#495867]">{t("media.file")}</span>
              <input
                type="file"
                accept="image/*,application/pdf,video/mp4,video/webm"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[#495867]">{t("media.titleFr")}</span>
              <input
                className="w-full rounded-md border border-[#d4dde6] px-3 py-2"
                value={form.titleFr}
                onChange={(e) => setForm({ ...form, titleFr: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[#495867]">{t("media.titleEn")}</span>
              <input
                className="w-full rounded-md border border-[#d4dde6] px-3 py-2"
                value={form.titleEn}
                onChange={(e) => setForm({ ...form, titleEn: e.target.value })}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-[#495867]">{t("media.descFr")}</span>
              <textarea
                rows={2}
                className="w-full rounded-md border border-[#d4dde6] px-3 py-2"
                value={form.descriptionFr}
                onChange={(e) => setForm({ ...form, descriptionFr: e.target.value })}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-[#495867]">{t("media.descEn")}</span>
              <textarea
                rows={2}
                className="w-full rounded-md border border-[#d4dde6] px-3 py-2"
                value={form.descriptionEn}
                onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })}
              />
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={busy || (editingId === "new" && !file)}
              onClick={() => void save()}
              className="rounded-md bg-[#495867] px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {t("media.save")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={cancelEdit}
              className="rounded-md border border-[#d4dde6] px-4 py-2 text-sm"
            >
              {t("media.cancel")}
            </button>
          </div>
        </div>
      )}

      <EditorListSearch
        value={q}
        placeholder={t("media.search")}
        submitLabel={t("list.filter")}
        onSubmit={onSearch}
      />

      <div className="mb-3 flex flex-wrap gap-2">
        {KIND_FILTERS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`rounded border px-2 py-1 text-xs ${
              kind === k
                ? "border-[#495867] bg-[#495867] text-white"
                : "border-[#d4dde6] bg-white text-[#495867]"
            }`}
          >
            {kindLabel(k)}
          </button>
        ))}
      </div>

      {!loading && (
        <EditorListCount
          total={total}
          totalAll={totalAll}
          filtered={Boolean(q) || kind !== "ALL"}
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
                <th className="px-4 py-3 font-medium">{t("media.colPreview")}</th>
                <th className="px-4 py-3 font-medium">{t("media.colTitle")}</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">
                  {t("media.colKind")}
                </th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">
                  {t("media.colLinks")}
                </th>
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
                  <td className="px-4 py-3">{thumb(m)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#0D131A]">
                      {(locale === "fr" ? m.titleFr : m.titleEn) || m.id.slice(0, 8)}
                    </div>
                    <div className="text-xs text-[#495867]">{m.mimeType}</div>
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">{kindLabel(m.kind)}</td>
                  <td className="hidden px-4 py-3 text-[#495867] md:table-cell">
                    {m.posts?.length ?? 0}
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
                      <a
                        href={m.urlOrigin}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-[#495867] hover:underline"
                      >
                        {t("media.open")}
                      </a>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void remove(m)}
                        className="text-xs text-red-700 hover:underline"
                      >
                        {t("media.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && (
            <p className="px-4 py-8 text-center text-[#495867]">{t("media.empty")}</p>
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
