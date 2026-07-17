"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "./LocaleProvider";
import { EditorListCount } from "./EditorListCount";
import { EditorListSearch } from "./EditorListSearch";
import { useEditorInfiniteList } from "./useEditorInfiniteList";
import { MediaPreview } from "./MediaPreview";
import { MediaKindThumb } from "./MediaKindThumb";
import { PhotoCanvasEditor } from "./PhotoCanvasEditor";
import { FullscreenEditorModal } from "./FullscreenEditorModal";
import {
  MEDIA_ACCEPT,
  isAllowedMediaFile,
  kindFromFile,
  mediaFileFromDataTransfer,
  type MediaKindClient,
} from "@/lib/media-file-client";
import {
  DEFAULT_IMAGE_LAYOUT,
  layoutFromLegacy,
  type ImageLayoutParams,
} from "@/lib/image-layout";

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
  offsetX?: number;
  offsetY?: number;
  scaleX?: number;
  scaleY?: number;
  lockAspect?: boolean;
  rotation: number;
  cropShape?: string;
  backgroundColor?: string;
  cropInset?: number;
  focusX?: number;
  focusY?: number;
  zoom?: number;
  cropX?: number;
  cropY?: number;
  cropW?: number;
  cropH?: number;
  posts?: { post: { id: string; titleFr: string; slug: string } }[];
};

type FormState = {
  titleFr: string;
  titleEn: string;
  descriptionFr: string;
  descriptionEn: string;
  takenAt: string;
  layout: ImageLayoutParams;
};

const emptyForm: FormState = {
  titleFr: "",
  titleEn: "",
  descriptionFr: "",
  descriptionEn: "",
  takenAt: "",
  layout: { ...DEFAULT_IMAGE_LAYOUT },
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
    layout: layoutFromLegacy(m),
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
        if (data.kind === "IMAGE" && data.id) {
          const layoutRes = await fetch(`/api/media-library/${data.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form.layout),
          });
          if (!layoutRes.ok) throw new Error(t("media.saveError"));
        }
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
          Object.assign(patchBody, form.layout);
        }
        if (file) {
          const fd = new FormData();
          fd.set("file", file);
          const rep = await fetch(`/api/media-library/${editingId}/replace`, {
            method: "POST",
            body: fd,
          });
          if (!rep.ok) throw new Error(t("media.saveError"));
        }
        const res = await fetch(`/api/media-library/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchBody),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? t("media.saveError"));
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
    return (
      <MediaKindThumb
        kind={m.kind}
        mimeType={m.mimeType}
        src={
          m.kind === "IMAGE" && m.mimeType?.startsWith("image/")
            ? m.urlPicto || m.urlMoyenne || m.urlOrigin
            : m.urlPicto || m.urlMoyenne || null
        }
      />
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
            disabled={busy}
            onClick={startCreate}
            className="rounded-md bg-[#495867] px-3 py-2 text-sm text-white hover:bg-[#3a4654] disabled:opacity-50"
          >
            {t("media.new")}
          </button>
        </div>
      </div>

      {(error || localError) && !editingId && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">
          {localError ||
            (error === "LOAD_FAILED" ? t("list.loadError") : error)}
        </p>
      )}

      {editingId && (
        <FullscreenEditorModal
          title={editingId === "new" ? t("media.new") : t("media.edit")}
          onClose={cancelEdit}
          busy={busy}
          error={localError || (error && error !== "LOAD_FAILED" ? error : null)}
          footerRight={
            <>
              <button
                type="button"
                disabled={busy}
                onClick={cancelEdit}
                className="rounded-md border border-[#d4dde6] px-4 py-2 text-sm"
              >
                {t("media.cancel")}
              </button>
              <button
                type="button"
                disabled={busy || (editingId === "new" && !file)}
                onClick={() => void save()}
                className="rounded-md bg-[#495867] px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {t("media.save")}
              </button>
            </>
          }
        >
          <div className="flex h-full min-h-0 flex-col md:flex-row">
            <section className="flex min-h-[38vh] flex-1 items-center justify-center bg-[#eef3f7] p-3 md:min-h-0">
              {(previewKind === "IMAGE" || editingMedia?.kind === "IMAGE") &&
              (filePreviewUrl ||
                (editingMedia &&
                  (editingMedia.urlOrigin || editingMedia.urlGrande))) ? (
                <PhotoCanvasEditor
                  imageSrc={
                    filePreviewUrl ||
                    editingMedia!.urlOrigin ||
                    editingMedia!.urlGrande!
                  }
                  value={form.layout}
                  onChange={(layout) => setForm({ ...form, layout })}
                  disabled={busy}
                  fillStage
                  showControls={false}
                />
              ) : previewKind && previewSrc ? (
                <div className="w-full max-w-lg">
                  <MediaPreview
                    kind={previewKind}
                    src={previewSrc}
                    title={
                      (locale === "fr" ? form.titleFr : form.titleEn) ||
                      file?.name
                    }
                    openLabel={t("media.open")}
                  />
                </div>
              ) : (
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
                  className={`mx-4 w-full max-w-md rounded-lg border-2 border-dashed px-4 py-12 text-center ${
                    dragOver
                      ? "border-[#495867] bg-white"
                      : "border-[#d4dde6] bg-white/70"
                  }`}
                >
                  <p className="text-sm text-[#495867]">{t("media.dropHint")}</p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={busy}
                    className="mt-2 rounded-md border border-[#495867] px-3 py-1.5 text-sm text-[#495867] hover:bg-[#eef3f7] disabled:opacity-50"
                  >
                    {t("media.chooseFile")}
                  </button>
                  <p className="mt-2 text-xs text-[#495867]">
                    {t("media.pasteHint")}
                  </p>
                </div>
              )}
            </section>

            <aside className="flex w-full shrink-0 flex-col overflow-y-auto border-t border-[#d4dde6] md:w-[min(100%,24rem)] md:border-l md:border-t-0">
              <div className="space-y-3 p-3 sm:p-4">
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-[#495867]">
                    {t("media.file")}
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={busy}
                    className="w-full rounded border border-[#d4dde6] px-3 py-1.5 text-sm text-[#495867] hover:bg-[#eef3f7] disabled:opacity-50"
                  >
                    {editingId === "new"
                      ? t("media.chooseFile")
                      : t("media.replaceFile")}
                  </button>
                  {file && (
                    <p className="truncate text-[11px] text-[#0D131A]">
                      {file.name} ({Math.round(file.size / 1024)} Ko)
                    </p>
                  )}
                  {previewKind && (
                    <p className="text-[11px] text-[#495867]">
                      {t("media.detectedKind")}: {kindLabel(previewKind)}
                    </p>
                  )}
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
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <label className="block">
                    <span className="text-[11px] text-[#495867]">
                      {t("media.titleFr")}
                    </span>
                    <input
                      className="mt-0.5 w-full rounded border border-[#d4dde6] px-2 py-1 text-sm"
                      value={form.titleFr}
                      onChange={(e) =>
                        setForm({ ...form, titleFr: e.target.value })
                      }
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-[#495867]">
                      {t("media.titleEn")}
                    </span>
                    <input
                      className="mt-0.5 w-full rounded border border-[#d4dde6] px-2 py-1 text-sm"
                      value={form.titleEn}
                      onChange={(e) =>
                        setForm({ ...form, titleEn: e.target.value })
                      }
                    />
                  </label>
                  <label className="col-span-2 block">
                    <span className="text-[11px] text-[#495867]">
                      {t("media.descFr")}
                    </span>
                    <textarea
                      rows={2}
                      className="mt-0.5 w-full rounded border border-[#d4dde6] px-2 py-1 text-sm"
                      value={form.descriptionFr}
                      onChange={(e) =>
                        setForm({ ...form, descriptionFr: e.target.value })
                      }
                    />
                  </label>
                  <label className="col-span-2 block">
                    <span className="text-[11px] text-[#495867]">
                      {t("media.descEn")}
                    </span>
                    <textarea
                      rows={2}
                      className="mt-0.5 w-full rounded border border-[#d4dde6] px-2 py-1 text-sm"
                      value={form.descriptionEn}
                      onChange={(e) =>
                        setForm({ ...form, descriptionEn: e.target.value })
                      }
                    />
                  </label>
                  {(previewKind === "IMAGE" ||
                    editingMedia?.kind === "IMAGE") && (
                    <label className="col-span-2 block">
                      <span className="text-[11px] text-[#495867]">
                        {t("media.takenAt")}
                      </span>
                      <input
                        type="date"
                        className="mt-0.5 w-full rounded border border-[#d4dde6] px-2 py-1 text-sm"
                        value={form.takenAt}
                        onChange={(e) =>
                          setForm({ ...form, takenAt: e.target.value })
                        }
                      />
                    </label>
                  )}
                </div>

                {(previewKind === "IMAGE" || editingMedia?.kind === "IMAGE") &&
                  (filePreviewUrl ||
                    (editingMedia &&
                      (editingMedia.urlOrigin || editingMedia.urlGrande))) && (
                    <div className="border-t border-[#eef3f7] pt-3">
                      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[#495867]">
                        {t("media.transforms")}
                      </p>
                      <PhotoCanvasEditor
                        imageSrc={
                          filePreviewUrl ||
                          editingMedia!.urlOrigin ||
                          editingMedia!.urlGrande!
                        }
                        value={form.layout}
                        onChange={(layout) => setForm({ ...form, layout })}
                        disabled={busy}
                        showStage={false}
                      />
                    </div>
                  )}
              </div>
            </aside>
          </div>
        </FullscreenEditorModal>
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
