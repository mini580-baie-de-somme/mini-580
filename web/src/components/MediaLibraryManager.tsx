"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "./LocaleProvider";
import { EditorListCount } from "./EditorListCount";
import { EditorListSearch } from "./EditorListSearch";
import { useEditorInfiniteList } from "./useEditorInfiniteList";
import { MediaPreview } from "./MediaPreview";
import {
  MEDIA_ACCEPT,
  isAllowedMediaFile,
  kindFromFile,
  mediaFileFromDataTransfer,
  type MediaKindClient,
} from "@/lib/media-file-client";

type MediaKind = MediaKindClient;

type MediaItem = {
  id: string;
  kind: MediaKind;
  mimeType: string;
  urlOrigin: string;
  urlPicto: string | null;
  urlPetite: string | null;
  urlMoyenne: string | null;
  urlGrande: string | null;
  titleFr: string;
  titleEn: string;
  descriptionFr: string;
  descriptionEn: string;
  takenAt: string | Date | null;
  focusX: number;
  focusY: number;
  zoom: number;
  rotation: number;
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
  posts?: { post: { id: string; titleFr: string; slug: string } }[];
};

type FormState = {
  titleFr: string;
  titleEn: string;
  descriptionFr: string;
  descriptionEn: string;
  takenAt: string;
  focusX: number;
  focusY: number;
  zoom: number;
  rotation: number;
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
};

const emptyForm: FormState = {
  titleFr: "",
  titleEn: "",
  descriptionFr: "",
  descriptionEn: "",
  takenAt: "",
  focusX: 0.5,
  focusY: 0.5,
  zoom: 1,
  rotation: 0,
  cropX: 0,
  cropY: 0,
  cropW: 1,
  cropH: 1,
};

const KIND_FILTERS: Array<"ALL" | MediaKind> = ["ALL", "IMAGE", "DOCUMENT", "VIDEO"];

function formFromMedia(m: MediaItem): FormState {
  const taken =
    m.takenAt == null
      ? ""
      : (typeof m.takenAt === "string"
          ? m.takenAt
          : new Date(m.takenAt).toISOString()
        ).slice(0, 10);
  return {
    titleFr: m.titleFr,
    titleEn: m.titleEn,
    descriptionFr: m.descriptionFr,
    descriptionEn: m.descriptionEn,
    takenAt: taken,
    focusX: m.focusX ?? 0.5,
    focusY: m.focusY ?? 0.5,
    zoom: m.zoom ?? 1,
    rotation: m.rotation ?? 0,
    cropX: m.cropX ?? 0,
    cropY: m.cropY ?? 0,
    cropW: m.cropW ?? 1,
    cropH: m.cropH ?? 1,
  };
}

function previewSrcForMedia(m: MediaItem): string {
  if (m.kind === "IMAGE") {
    return m.urlMoyenne || m.urlGrande || m.urlPetite || m.urlOrigin;
  }
  return m.urlOrigin;
}

export function MediaLibraryManager() {
  const { locale, t } = useLocale();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"ALL" | MediaKind>("ALL");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingMedia, setEditingMedia] = useState<MediaItem | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (!file) {
      setFilePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setFilePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const acceptFile = useCallback(
    (next: File | null) => {
      setLocalError(null);
      if (!next) {
        setFile(null);
        return;
      }
      if (!isAllowedMediaFile(next)) {
        setLocalError(t("media.fileInvalid"));
        return;
      }
      setFile(next);
    },
    [t]
  );

  useEffect(() => {
    if (!editingId) return;
    function onPaste(e: ClipboardEvent) {
      if (busy) return;
      const next = mediaFileFromDataTransfer(e.clipboardData);
      if (!next) return;
      e.preventDefault();
      acceptFile(next);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [editingId, busy, acceptFile]);

  function startCreate() {
    setEditingId("new");
    setEditingMedia(null);
    setForm(emptyForm);
    setFile(null);
    setLocalError(null);
  }

  async function startEdit(m: MediaItem) {
    setEditingId(m.id);
    setEditingMedia(m);
    setForm(formFromMedia(m));
    setFile(null);
    setLocalError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/media-library/${m.id}`);
      if (res.ok) {
        const full = (await res.json()) as MediaItem;
        setEditingMedia(full);
        setForm(formFromMedia(full));
      }
    } catch {
      // keep list row data
    } finally {
      setBusy(false);
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingMedia(null);
    setForm(emptyForm);
    setFile(null);
    setLocalError(null);
  }

  async function save() {
    setBusy(true);
    setError(null);
    setLocalError(null);
    try {
      if (editingId === "new") {
        if (!file) throw new Error(t("media.fileRequired"));
        const fd = new FormData();
        fd.set("file", file);
        fd.set("titleFr", form.titleFr);
        fd.set("titleEn", form.titleEn);
        fd.set("descriptionFr", form.descriptionFr);
        fd.set("descriptionEn", form.descriptionEn);
        if (form.takenAt) {
          fd.set("takenAt", new Date(form.takenAt).toISOString());
        }
        const res = await fetch("/api/media-library", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? t("media.saveError"));
      } else {
        const patchBody: Record<string, unknown> = {
          titleFr: form.titleFr,
          titleEn: form.titleEn,
          descriptionFr: form.descriptionFr,
          descriptionEn: form.descriptionEn,
          takenAt: form.takenAt
            ? new Date(form.takenAt).toISOString()
            : null,
        };
        const effectiveKind = file
          ? kindFromFile(file)
          : editingMedia?.kind ?? null;
        if (effectiveKind === "IMAGE") {
          Object.assign(patchBody, {
            focusX: form.focusX,
            focusY: form.focusY,
            zoom: form.zoom,
            rotation: form.rotation,
            cropX: form.cropX,
            cropY: form.cropY,
            cropW: form.cropW,
            cropH: form.cropH,
          });
        }
        const res = await fetch(`/api/media-library/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchBody),
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
      if (editingId === m.id) cancelEdit();
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

  const previewKind: MediaKind | null = file
    ? kindFromFile(file)
    : editingMedia
      ? editingMedia.kind
      : null;
  const previewSrc = filePreviewUrl
    ? filePreviewUrl
    : editingMedia
      ? previewSrcForMedia(editingMedia)
      : null;
  const showImageTransforms =
    previewKind === "IMAGE" && editingId !== null && editingId !== "new";

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

      {(error || localError) && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">
          {localError ||
            (error === "LOAD_FAILED" ? t("list.loadError") : error)}
        </p>
      )}

      {editingId && (
        <div className="rounded-lg border border-[#d4dde6] bg-white p-4 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold text-[#0D131A]">
            {editingId === "new" ? t("media.new") : t("media.edit")}
          </h2>

          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <p className="text-sm font-medium text-[#495867]">{t("media.file")}</p>
              <div
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const next = mediaFileFromDataTransfer(e.dataTransfer);
                  if (next) acceptFile(next);
                  else setLocalError(t("media.fileInvalid"));
                }}
                className={`rounded-lg border-2 border-dashed px-4 py-8 text-center ${
                  dragOver
                    ? "border-[#495867] bg-[#eef3f7]"
                    : "border-[#d4dde6] bg-[#fafbfc]"
                }`}
              >
                <p className="text-sm text-[#495867]">{t("media.dropHint")}</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                  className="mt-2 rounded-md border border-[#495867] px-3 py-1.5 text-sm text-[#495867] hover:bg-white disabled:opacity-50"
                >
                  {editingId === "new"
                    ? t("media.chooseFile")
                    : t("media.replaceFile")}
                </button>
                <p className="mt-2 text-xs text-[#495867]">{t("media.pasteHint")}</p>
                {file && (
                  <p className="mt-2 truncate text-xs text-[#0D131A]">
                    {file.name} ({Math.round(file.size / 1024)} Ko)
                  </p>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={MEDIA_ACCEPT}
                className="hidden"
                onChange={(e) => {
                  acceptFile(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
              {previewKind && (
                <p className="text-xs text-[#495867]">
                  {t("media.detectedKind")}: {kindLabel(previewKind)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-[#495867]">{t("media.preview")}</p>
              {previewKind && previewSrc ? (
                <MediaPreview
                  kind={previewKind}
                  src={previewSrc}
                  title={
                    (locale === "fr" ? form.titleFr : form.titleEn) ||
                    file?.name
                  }
                  openLabel={t("media.open")}
                />
              ) : (
                <p className="rounded-lg border border-dashed border-[#d4dde6] bg-[#fafbfc] px-4 py-10 text-center text-sm text-[#495867]">
                  {t("media.fileRequired")}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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
                onChange={(e) =>
                  setForm({ ...form, descriptionFr: e.target.value })
                }
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-[#495867]">{t("media.descEn")}</span>
              <textarea
                rows={2}
                className="w-full rounded-md border border-[#d4dde6] px-3 py-2"
                value={form.descriptionEn}
                onChange={(e) =>
                  setForm({ ...form, descriptionEn: e.target.value })
                }
              />
            </label>
            {(previewKind === "IMAGE" || editingMedia?.kind === "IMAGE") && (
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-[#495867]">{t("media.takenAt")}</span>
                <input
                  type="date"
                  className="w-full rounded-md border border-[#d4dde6] px-3 py-2"
                  value={form.takenAt}
                  onChange={(e) =>
                    setForm({ ...form, takenAt: e.target.value })
                  }
                />
              </label>
            )}
          </div>

          {showImageTransforms && (
            <fieldset className="mt-4 space-y-2 rounded border border-[#d4dde6] p-3">
              <legend className="px-1 text-xs font-medium text-[#495867]">
                {t("media.transforms")}
              </legend>
              <label className="flex items-center gap-2 text-sm">
                <span className="w-20 text-xs">Focus X</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={form.focusX}
                  onChange={(e) =>
                    setForm({ ...form, focusX: Number(e.target.value) })
                  }
                  className="flex-1"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <span className="w-20 text-xs">Focus Y</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={form.focusY}
                  onChange={(e) =>
                    setForm({ ...form, focusY: Number(e.target.value) })
                  }
                  className="flex-1"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <span className="w-20 text-xs">Zoom</span>
                <input
                  type="range"
                  min={0.5}
                  max={3}
                  step={0.05}
                  value={form.zoom}
                  onChange={(e) =>
                    setForm({ ...form, zoom: Number(e.target.value) })
                  }
                  className="flex-1"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <span className="w-20 text-xs">Rotation</span>
                <select
                  value={form.rotation}
                  onChange={(e) =>
                    setForm({ ...form, rotation: Number(e.target.value) })
                  }
                  className="rounded border border-[#d4dde6] px-2 py-1"
                >
                  {[0, 90, 180, 270].map((d) => (
                    <option key={d} value={d}>
                      {d}°
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(
                  [
                    ["cropX", form.cropX],
                    ["cropY", form.cropY],
                    ["cropW", form.cropW],
                    ["cropH", form.cropH],
                  ] as const
                ).map(([key, val]) => (
                  <label key={key} className="flex items-center gap-1 text-sm">
                    <span className="w-10 text-[10px] uppercase text-[#495867]">
                      {key.replace("crop", "")}
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.01}
                      value={val}
                      onChange={(e) =>
                        setForm({ ...form, [key]: Number(e.target.value) })
                      }
                      className="w-full rounded border border-[#d4dde6] px-1 py-0.5 text-xs"
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          )}

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
                  onClick={() => void startEdit(m)}
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
                        onClick={() => void startEdit(m)}
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
