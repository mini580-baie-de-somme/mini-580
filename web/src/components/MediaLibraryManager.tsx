"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualUrl } from "@/hooks/useVirtualUrl";
import {
  MEDIA_EDIT_PARAM_KEYS,
  MEDIA_GROUP_PARAM_KEYS,
  parseMediaEditState,
  parseMediaGroupEditState,
  serializeMediaEditState,
  serializeMediaGroupEditState,
} from "@/lib/virtual-url";
import { useLocale } from "./LocaleProvider";
import { EditorListCount } from "./EditorListCount";
import { EditorListSearch } from "./EditorListSearch";
import { EditorPageHeader, editorHeaderBtnPrimary, editorHeaderBtnSecondary } from "./EditorPageHeader";
import {
  EditorFilterChip,
  EditorFilterGroup,
  type EditorListActiveChip,
} from "./EditorListToolbar";
import {
  MEDIA_LIBRARY_FILTER_KEYS,
  mediaLibraryFiltersFromParams,
  mediaLibraryListQueryString,
  type MediaLibraryVisibilityFilter,
} from "@/lib/media-library-filters";
import { countListFilters } from "@/lib/editor-list";
import { useEditorInfiniteList } from "./useEditorInfiniteList";
import { MediaPreview } from "./MediaPreview";
import { MediaKindThumb } from "./MediaKindThumb";
import { DatetimeLocalInput } from "./DatetimeLocalInput";
import { EditorSheetPanel } from "./EditorSheetPanel";
import { PhotoCanvasEditor } from "./PhotoCanvasEditor";
import { editorCanvasSrc } from "@/lib/gallery-editor";
import { FullscreenEditorModal } from "./FullscreenEditorModal";
import {
  MEDIA_ACCEPT,
  kindFromFile,
  mediaFileFromDataTransfer,
  type MediaKindClient,
} from "@/lib/media-file-client";
import {
  formatMaxMb,
  MEDIA_MAX_BYTES,
  MEDIA_VIDEO_MAX_BYTES,
} from "@/lib/media-limits";
import {
  DEFAULT_IMAGE_LAYOUT,
  layoutFromLegacy,
  layoutParamsDiffer,
  type ImageLayoutParams,
} from "@/lib/image-layout";
import {
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "@/lib/utils";
import {
  followUpLibraryRebakePoll,
  getSaveFlowErrorPhase,
  saveMediaFlow,
} from "@/lib/save-media-flow";
import {
  formatMediaSaveError,
  readMediaApiError,
  wrapMediaSaveErrorMessage,
} from "@/lib/media-save-errors";
import { useMediaFileQueue } from "@/hooks/useMediaFileQueue";
import type { MediaIntegrity } from "@/lib/media-integrity-types";
import { MediaIntegrityNotice } from "./MediaIntegrityNotice";
import { MediaClipboardPasteButton } from "./MediaClipboardPasteButton";
import { MediaGroupChips, type MediaGroupSummary } from "./MediaGroupChips";
import { MediaGroupEditor } from "./MediaGroupEditor";
import { MediaLibraryMobileCard } from "./MediaLibraryMobileCard";

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
  posts?: {
    post: {
      id: string;
      titleFr: string;
      slug: string;
      status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    };
  }[];
  groupMembers?: {
    group: MediaGroupSummary;
  }[];
  integrity?: MediaIntegrity;
};

type VisibilityFilter = MediaLibraryVisibilityFilter;

type MediaGroupOption = MediaGroupSummary & { memberCount?: number };

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
const VISIBILITY_FILTERS: VisibilityFilter[] = [
  "ALL",
  "public",
  "draft",
  "orphan",
];

function mediaVisibility(
  m: MediaItem
): "public" | "draft" | "orphan" {
  const posts = m.posts ?? [];
  if (posts.length === 0) return "orphan";
  if (posts.some((p) => p.post.status === "PUBLISHED")) return "public";
  return "draft";
}

function formFromMedia(m: MediaItem): FormState {
  return {
    titleFr: m.titleFr,
    titleEn: m.titleEn,
    descriptionFr: m.descriptionFr,
    descriptionEn: m.descriptionEn,
    takenAt: toDatetimeLocalValue(m.takenAt),
    layout: layoutFromLegacy(m),
  };
}

function previewSrcForMedia(m: MediaItem): string {
  if (m.kind === "IMAGE") {
    return m.urlMoyenne || m.urlGrande || m.urlPetite || m.urlOrigin;
  }
  return m.urlOrigin;
}

function groupsFromMedia(m: MediaItem): MediaGroupSummary[] {
  return (m.groupMembers ?? []).map((gm) => gm.group);
}

function withSizeLimits(template: string): string {
  return template
    .replace("{photoMax}", String(formatMaxMb(MEDIA_MAX_BYTES)))
    .replace("{videoMax}", String(formatMaxMb(MEDIA_VIDEO_MAX_BYTES)));
}

async function readApiJson(
  res: Response
): Promise<{ error?: string; kind?: string; id?: string; [k: string]: unknown }> {
  return readMediaApiError(res) as {
    error?: string;
    kind?: string;
    id?: string;
  };
}

export function MediaLibraryManager() {
  const { locale, t } = useLocale();
  const { searchParams, pushVirtual, replaceVirtual, closeVirtual, markOpenedViaPush } =
    useVirtualUrl();
  const editingId = parseMediaEditState(searchParams);
  const editingGroupId = parseMediaGroupEditState(searchParams);
  const filterParamsKey = searchParams.toString();
  const { q, kind, visibility, groupFilterId } = useMemo(
    () => mediaLibraryFiltersFromParams(new URLSearchParams(filterParamsKey)),
    [filterParamsKey]
  );
  const [groupOptions, setGroupOptions] = useState<MediaGroupOption[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editingMedia, setEditingMedia] = useState<MediaItem | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [originEditable, setOriginEditable] = useState(false);
  const [editingIntegrity, setEditingIntegrity] = useState<MediaIntegrity | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fileQueueMessages = useMemo(
    () => ({
      fileInvalid: t("media.fileInvalid"),
      fileTooLarge: t("media.fileTooLarge"),
      fileTooLargeVideo: t("media.fileTooLargeVideo"),
    }),
    [t]
  );

  const {
    file,
    previewUrl: filePreviewUrl,
    acceptFile,
    clearFile,
  } = useMediaFileQueue({
    busy,
    enabled: Boolean(editingId),
    messages: fileQueueMessages,
    onError: setLocalError,
    onAccepted: () => {
      setForm((prev) => ({
        ...prev,
        layout: { ...DEFAULT_IMAGE_LAYOUT },
      }));
    },
  });

  const queryString = useMemo(
    () => mediaLibraryListQueryString(new URLSearchParams(filterParamsKey)),
    [filterParamsKey]
  );

  const updateFilter = useCallback(
    (key: (typeof MEDIA_LIBRARY_FILTER_KEYS)[number], value: string) => {
      replaceVirtual({
        [key]: value && value !== "ALL" ? value : null,
      });
    },
    [replaceVirtual]
  );

  const reloadGroups = useCallback(async () => {
    try {
      const res = await fetch("/api/media-groups");
      if (!res.ok) return;
      const data = (await res.json()) as MediaGroupOption[] | { items: MediaGroupOption[] };
      setGroupOptions(Array.isArray(data) ? data : (data.items ?? []));
    } catch {
      // keep previous options
    }
  }, []);

  useEffect(() => {
    void reloadGroups();
  }, [reloadGroups]);

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

  function resetEditForm() {
    setEditingMedia(null);
    setForm(emptyForm);
    clearFile();
    setLocalError(null);
    setOriginEditable(true);
    setEditingIntegrity(null);
  }

  function openMediaEdit(id: string) {
    pushVirtual(
      { ...serializeMediaEditState(id), ...serializeMediaGroupEditState(null) },
      MEDIA_GROUP_PARAM_KEYS
    );
    markOpenedViaPush();
  }

  function openGroupEdit(id: string) {
    pushVirtual(
      { ...serializeMediaGroupEditState(id), ...serializeMediaEditState(null) },
      MEDIA_EDIT_PARAM_KEYS
    );
    markOpenedViaPush();
  }

  async function startNewGroup() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/media-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleFr: "", titleEn: "" }),
      });
      const data = await readApiJson(res);
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : t("mediaGroup.saveError")
        );
      }
      const group = data as { id: string };
      await reloadGroups();
      openGroupEdit(group.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("mediaGroup.saveError"));
    } finally {
      setBusy(false);
    }
  }

  const handleGroupSaved = useCallback(() => {
    void reload();
    void reloadGroups();
  }, [reload, reloadGroups]);

  function cancelGroupEdit() {
    closeVirtual(MEDIA_GROUP_PARAM_KEYS);
  }

  function startCreate() {
    openMediaEdit("new");
  }

  async function startEdit(m: MediaItem) {
    openMediaEdit(m.id);
  }

  useEffect(() => {
    if (!editingId) {
      resetEditForm();
      return;
    }
    if (editingId === "new") {
      resetEditForm();
      return;
    }
    const listRow = items.find((m) => m.id === editingId) ?? null;
    let cancelled = false;
    void (async () => {
      if (listRow) {
        setEditingMedia(listRow);
        setForm(formFromMedia(listRow));
        clearFile();
        setLocalError(null);
        setOriginEditable(listRow.integrity?.editable ?? false);
        setEditingIntegrity(listRow.integrity ?? null);
      }
      setBusy(true);
      try {
        const res = await fetch(`/api/media-library/${editingId}`);
        if (cancelled) return;
        if (res.ok) {
          const full = (await res.json()) as MediaItem;
          setEditingMedia(full);
          setForm(formFromMedia(full));
          setOriginEditable(full.integrity?.editable ?? false);
          setEditingIntegrity(full.integrity ?? null);
          if (
            full.kind === "IMAGE" &&
            full.integrity &&
            !full.integrity.editable
          ) {
            setLocalError(t("media.integrity.notEditable"));
          }
        }
      } catch {
        // keep list row data
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);

  function cancelEdit() {
    closeVirtual(MEDIA_EDIT_PARAM_KEYS);
  }

  async function save() {
    const effectiveKind = file
      ? kindFromFile(file)
      : editingMedia?.kind ?? null;
    if (
      effectiveKind === "IMAGE" &&
      editingId !== "new" &&
      editingMedia &&
      !file &&
      !originEditable &&
      layoutParamsDiffer(form.layout, layoutFromLegacy(editingMedia))
    ) {
      setLocalError(
        locale === "fr"
          ? "Impossible d'enregistrer le cadrage — original absent ou stockage non vérifiable. Remplace le fichier ou restaure l'originale."
          : "Cannot save layout — original missing or storage could not be verified. Replace the file or restore the original."
      );
      return;
    }

    setBusy(true);
    setError(null);
    setLocalError(null);
    try {
      const layoutChanged =
        Boolean(editingMedia) &&
        layoutParamsDiffer(form.layout, layoutFromLegacy(editingMedia!));
      const metadata = {
        titleFr: form.titleFr,
        titleEn: form.titleEn,
        descriptionFr: form.descriptionFr,
        descriptionEn: form.descriptionEn,
        takenAt: fromDatetimeLocalValue(form.takenAt),
      };
      const result = await saveMediaFlow({
        strategy: "library",
        mode: editingId === "new" ? "create" : "edit",
        mediaId: editingId === "new" ? undefined : (editingId ?? undefined),
        pendingFile: file,
        effectiveKind,
        metadata,
        layout: form.layout,
        originEditable,
        layoutChanged,
        locale,
        messages: {
          saveError: t("media.saveError"),
          uploadRejected: t("media.uploadRejected"),
          localStorageRequired: t("media.localStorageRequired"),
          fileRequired: t("media.fileRequired"),
        },
        formatUploadRejected: withSizeLimits,
      });
      if (file) {
        setOriginEditable(true);
        setLocalError(null);
      }
      cancelEdit();
      await reload();
      if (result.layoutPatched && result.patchVariantBaseline && editingId !== "new") {
        followUpLibraryRebakePoll({
          mediaId: result.saved.id,
          patchVariantBaseline: result.patchVariantBaseline,
          onReload: reload,
        });
      }
    } catch (e) {
      const phase = getSaveFlowErrorPhase(e);
      const message = formatMediaSaveError(e, locale, phase);
      setError(wrapMediaSaveErrorMessage(message, locale));
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

  const onSearch = useCallback(
    (next: string) => updateFilter("q", next.trim()),
    [updateFilter]
  );

  function kindLabel(k: MediaKind | "ALL") {
    if (k === "ALL") return t("media.kind.all");
    if (k === "IMAGE") return t("media.kind.image");
    if (k === "DOCUMENT") return t("media.kind.document");
    return t("media.kind.video");
  }

  function visibilityLabel(v: VisibilityFilter) {
    if (v === "ALL") return t("media.visibility.all");
    if (v === "public") return t("media.visibility.public");
    if (v === "draft") return t("media.visibility.draft");
    return t("media.visibility.orphan");
  }

  function visibilityBadge(m: MediaItem) {
    const v = mediaVisibility(m);
    const label =
      v === "public"
        ? t("media.visibility.public")
        : v === "draft"
          ? t("media.visibility.draft")
          : t("media.visibility.orphan");
    const hint =
      v === "public"
        ? t("media.visibility.publicHint")
        : v === "draft"
          ? t("media.visibility.draftHint")
          : t("media.visibility.orphanHint");
    const cls =
      v === "public"
        ? "bg-emerald-100 text-emerald-800"
        : v === "draft"
          ? "bg-amber-100 text-amber-800"
          : "bg-[#eef3f7] text-[#495867]";
    return (
      <span
        title={hint}
        className={`inline-block rounded px-2 py-0.5 text-[11px] font-medium ${cls}`}
      >
        {label}
      </span>
    );
  }

  function integrityBadge(m: MediaItem) {
    const broken = m.integrity ? !m.integrity.ok : false;
    if (!broken) {
      return (
        <span
          title={t("media.integrity.ok")}
          className="inline-block rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800"
        >
          {t("media.integrity.ok")}
        </span>
      );
    }
    return (
      <span
        title={m.integrity?.messages.join(" · ") || t("media.integrity.brokenHint")}
        className="inline-block rounded bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-800"
      >
        {t("media.integrity.broken")}
      </span>
    );
  }

  function thumbSrc(m: MediaItem): string | null {
    if (m.kind === "IMAGE" && m.mimeType?.startsWith("image/")) {
      return m.urlPicto || m.urlMoyenne || m.urlOrigin;
    }
    return m.urlPicto || m.urlMoyenne || null;
  }

  function thumb(m: MediaItem, size: "sm" | "md" = "sm") {
    return (
      <MediaKindThumb
        kind={m.kind}
        mimeType={m.mimeType}
        src={thumbSrc(m)}
        size={size}
        className={size === "md" ? "ring-1 ring-[#d4dde6]" : undefined}
      />
    );
  }

  const previewKind: MediaKind | null = file
    ? kindFromFile(file)
    : editingMedia
      ? editingMedia.kind
      : null;
  const canEditImageLayout =
    (previewKind === "IMAGE" || editingMedia?.kind === "IMAGE") &&
    (Boolean(filePreviewUrl) || originEditable);
  const previewSrc = filePreviewUrl
    ? filePreviewUrl
    : editingMedia
      ? previewSrcForMedia(editingMedia)
      : null;
  const canvasSrc = editorCanvasSrc(editingMedia, filePreviewUrl);
  const hasCanvasPreview = Boolean(canvasSrc) && canEditImageLayout;

  return (
    <div className="space-y-4 sm:space-y-6">
      <EditorPageHeader
        title={
          <>
            <span className="sm:hidden">{t("media.titleShort")}</span>
            <span className="hidden sm:inline">{t("media.title")}</span>
          </>
        }
        subtitle={t("media.subtitle")}
        backLink={
          <Link href="/editeur" className={editorHeaderBtnSecondary("w-fit text-left")}>
            ← {t("nav.editor")}
          </Link>
        }
        actions={
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-row sm:flex-wrap sm:gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void startNewGroup()}
              className={editorHeaderBtnSecondary()}
            >
              {t("mediaGroup.new")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={startCreate}
              className={editorHeaderBtnPrimary()}
            >
              {t("media.new")}
            </button>
          </div>
        }
      />

      {(error || localError) && !editingId && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">
          {localError ||
            (error === "LOAD_FAILED" ? t("list.loadError") : error)}
        </p>
      )}

      {editingGroupId && (
        <MediaGroupEditor
          groupId={editingGroupId}
          onClose={cancelGroupEdit}
          onSaved={handleGroupSaved}
        />
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
          <div className="flex h-full min-h-0 flex-col overflow-hidden md:flex-row">
            <section
              className={`flex min-h-0 flex-1 overflow-hidden bg-[#eef3f7] md:min-h-0 md:flex-1 md:shrink ${
                hasCanvasPreview
                  ? "min-h-[24vh] touch-none items-center justify-center p-3 md:h-auto md:max-h-none md:min-h-0"
                  : previewKind && previewSrc
                    ? "min-h-[24vh] items-stretch justify-stretch p-0 md:h-auto md:max-h-none md:min-h-0"
                    : "min-h-[28vh] items-center justify-center p-3 md:min-h-0"
              }`}
            >
              {hasCanvasPreview ? (
                <PhotoCanvasEditor
                  imageSrc={canvasSrc!}
                  value={form.layout}
                  onChange={(layout) => setForm({ ...form, layout })}
                  disabled={busy}
                  fillStage
                  showControls={false}
                />
              ) : previewKind && previewSrc ? (
                <div className="flex h-full min-h-0 w-full flex-col p-2 sm:p-3">
                  {!originEditable &&
                    editingMedia?.kind === "IMAGE" &&
                    !filePreviewUrl && (
                      <MediaIntegrityNotice
                        panel
                        locale={locale}
                        integrity={editingIntegrity}
                        media={editingMedia}
                        message={t("media.integrity.notEditable")}
                        className="mb-2"
                      />
                    )}
                  <MediaPreview
                    kind={previewKind}
                    src={previewSrc}
                    title={
                      (locale === "fr" ? form.titleFr : form.titleEn) ||
                      file?.name
                    }
                    openLabel={t("media.open")}
                    fill
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
                  <p className="mt-2 text-xs text-[#495867]">
                    {withSizeLimits(t("media.sizeLimits"))}
                  </p>
                </div>
              )}
            </section>

            <EditorSheetPanel
              handleLabel={
                locale === "fr"
                  ? "Redimensionner le panneau de saisie"
                  : "Resize input panel"
              }
              className="md:w-[min(100%,24rem)] md:flex-none md:shrink-0 md:border-l md:border-t-0"
            >
              <div className="flex flex-col gap-3 p-3 sm:p-4">
                {(previewKind === "IMAGE" || editingMedia?.kind === "IMAGE") &&
                  canEditImageLayout &&
                  (filePreviewUrl ||
                    (editingMedia &&
                      (editingMedia.urlOrigin || editingMedia.urlGrande))) && (
                    <div className="order-first border-b border-[#eef3f7] pb-3 md:order-last md:border-b-0 md:border-t md:pt-3 md:pb-0">
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

                <div className="order-last space-y-3 md:order-first">
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-[#495867]">
                    {t("media.file")}
                  </p>
                  <p className="rounded-md bg-[#eef3f7] px-2.5 py-1.5 text-[11px] leading-snug text-[#495867]">
                    {withSizeLimits(t("media.sizeLimits"))}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={busy}
                      className="min-h-[44px] flex-1 rounded border border-[#d4dde6] px-3 py-1.5 text-sm text-[#495867] hover:bg-[#eef3f7] disabled:opacity-50"
                    >
                      {editingId === "new"
                        ? t("media.chooseFile")
                        : t("media.replaceFile")}
                    </button>
                    <MediaClipboardPasteButton
                      disabled={busy}
                      label={t("media.pasteFromClipboard")}
                      onFile={(next) => acceptFile(next)}
                      onError={(message) => setLocalError(message)}
                      errorMessage={(error) => {
                        switch (error) {
                          case "unsupported":
                            return t("media.pasteClipboardUnsupported");
                          case "empty":
                            return t("media.pasteClipboardEmpty");
                          case "permission":
                            return t("media.pasteClipboardPermission");
                          case "not_image":
                            return t("media.pasteClipboardNotImage");
                        }
                      }}
                    />
                  </div>
                  {file && (
                    <p className="truncate text-[11px] text-[#0D131A]">
                      {file.name} (
                      {file.size >= 1024 * 1024
                        ? `${(file.size / (1024 * 1024)).toFixed(1)} Mo`
                        : `${Math.round(file.size / 1024)} Ko`}
                      )
                      {file.type.startsWith("image/") ? (
                        <span className="text-[#495867]">
                          {" "}
                          · {t("media.pastePendingLocal")}
                        </span>
                      ) : null}
                    </p>
                  )}
                  {previewKind && (
                    <p className="text-[11px] text-[#495867]">
                      {t("media.detectedKind")}: {kindLabel(previewKind)}
                      {previewKind === "VIDEO"
                        ? ` · max ${formatMaxMb(MEDIA_VIDEO_MAX_BYTES)} Mo`
                        : ` · max ${formatMaxMb(MEDIA_MAX_BYTES)} Mo`}
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

                <div className="space-y-2 text-sm">
                  <div className="flex gap-2">
                    <label className="block min-w-0 flex-1">
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
                    <label className="block min-w-0 flex-1">
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
                  </div>
                  <label className="block">
                    <span className="text-[11px] text-[#495867]">
                      {t("media.descFr")}
                    </span>
                    <textarea
                      rows={4}
                      className="mt-0.5 min-h-[5.5rem] w-full rounded border border-[#d4dde6] px-2 py-1 text-sm"
                      value={form.descriptionFr}
                      onChange={(e) =>
                        setForm({ ...form, descriptionFr: e.target.value })
                      }
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-[#495867]">
                      {t("media.descEn")}
                    </span>
                    <textarea
                      rows={4}
                      className="mt-0.5 min-h-[5.5rem] w-full rounded border border-[#d4dde6] px-2 py-1 text-sm"
                      value={form.descriptionEn}
                      onChange={(e) =>
                        setForm({ ...form, descriptionEn: e.target.value })
                      }
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-[#495867]">
                      {t("media.takenAt")}
                    </span>
                    <DatetimeLocalInput
                      value={form.takenAt}
                      onChange={(value) =>
                        setForm({ ...form, takenAt: value })
                      }
                    />
                    <span className="mt-1 block text-[10px] text-[#495867]">
                      {t("media.takenAtHint")}
                    </span>
                  </label>

                  <div className="border-t border-[#eef3f7] pt-3">
                    <p className="text-[11px] font-medium text-[#495867]">
                      {t("mediaGroup.inGroups")}
                    </p>
                    {editingMedia && groupsFromMedia(editingMedia).length > 0 ? (
                      <div className="mt-1">
                        <MediaGroupChips
                          groups={groupsFromMedia(editingMedia)}
                          locale={locale}
                          maxVisible={6}
                          onGroupClick={openGroupEdit}
                        />
                      </div>
                    ) : (
                      <p className="mt-1 text-[10px] text-[#495867]">
                        {t("mediaGroup.none")}
                      </p>
                    )}
                  </div>
                </div>

                </div>
              </div>
            </EditorSheetPanel>
          </div>
        </FullscreenEditorModal>
      )}

      <EditorListSearch
        value={q}
        placeholder={t("media.search")}
        submitLabel={t("list.search")}
        onSubmit={onSearch}
        filtersOpen={filtersOpen}
        onFiltersOpenChange={setFiltersOpen}
        activeFilterCount={countListFilters(
          new URLSearchParams(filterParamsKey),
          [...MEDIA_LIBRARY_FILTER_KEYS]
        )}
        activeChips={((): EditorListActiveChip[] => {
          const chips: EditorListActiveChip[] = [];
          if (q) {
            chips.push({
              key: "q",
              prefix: t("editor.filters.search"),
              label: q,
            });
          }
          if (kind !== "ALL") {
            chips.push({
              key: "kind",
              prefix: t("media.colKind"),
              label: kindLabel(kind),
            });
          }
          if (visibility !== "ALL") {
            chips.push({
              key: "visibility",
              prefix: t("media.colVisibility"),
              label: visibilityLabel(visibility),
            });
          }
          if (groupFilterId) {
            const g = groupOptions.find((o) => o.id === groupFilterId);
            chips.push({
              key: "groupId",
              prefix: t("mediaGroup.filter"),
              label: g
                ? (locale === "fr" ? g.titleFr : g.titleEn) || g.slug || g.id.slice(0, 8)
                : groupFilterId.slice(0, 8),
            });
          }
          return chips;
        })()}
        onRemoveChip={(key) => {
          if (
            key === "q" ||
            key === "kind" ||
            key === "visibility" ||
            key === "groupId" ||
            key === "group"
          ) {
            updateFilter(
              key === "group" ? "groupId" : (key as (typeof MEDIA_LIBRARY_FILTER_KEYS)[number]),
              ""
            );
          }
        }}
        onClearAll={() => {
          replaceVirtual({
            q: null,
            kind: null,
            visibility: null,
            groupId: null,
          });
        }}
        filterPanel={
          <>
            <EditorFilterGroup label={t("media.colKind")}>
              {KIND_FILTERS.map((k) => (
                <EditorFilterChip
                  key={k}
                  active={
                    (k === "ALL" && kind === "ALL") ||
                    (k !== "ALL" && kind === k)
                  }
                  onClick={() =>
                    updateFilter(
                      "kind",
                      k === "ALL" ? "" : kind === k ? "" : k
                    )
                  }
                >
                  {kindLabel(k)}
                </EditorFilterChip>
              ))}
            </EditorFilterGroup>
            <EditorFilterGroup label={t("media.colVisibility")}>
              {VISIBILITY_FILTERS.map((v) => (
                <EditorFilterChip
                  key={v}
                  active={
                    (v === "ALL" && visibility === "ALL") ||
                    (v !== "ALL" && visibility === v)
                  }
                  onClick={() =>
                    updateFilter(
                      "visibility",
                      v === "ALL" ? "" : visibility === v ? "" : v
                    )
                  }
                >
                  {visibilityLabel(v)}
                </EditorFilterChip>
              ))}
            </EditorFilterGroup>
            <EditorFilterGroup label={t("mediaGroup.filter")}>
              <EditorFilterChip
                active={!groupFilterId}
                onClick={() => updateFilter("groupId", "")}
              >
                {t("mediaGroup.filterAll")}
              </EditorFilterChip>
              {groupOptions.map((g) => {
                const label =
                  (locale === "fr" ? g.titleFr : g.titleEn) ||
                  g.slug ||
                  g.id.slice(0, 8);
                return (
                  <EditorFilterChip
                    key={g.id}
                    active={groupFilterId === g.id}
                    onClick={() =>
                      updateFilter(
                        "groupId",
                        groupFilterId === g.id ? "" : g.id
                      )
                    }
                  >
                    {label}
                    {typeof g.memberCount === "number" ? ` (${g.memberCount})` : ""}
                  </EditorFilterChip>
                );
              })}
            </EditorFilterGroup>
          </>
        }
      />

      {!loading && (
        <EditorListCount
          total={total}
          totalAll={totalAll}
          filtered={
            countListFilters(
              new URLSearchParams(filterParamsKey),
              [...MEDIA_LIBRARY_FILTER_KEYS]
            ) > 0
          }
          totalLabel={t("list.count")}
          filteredLabel={t("list.countFiltered")}
        />
      )}

      {loading ? (
        <p className="text-sm text-[#495867]">{t("editor.loading")}</p>
      ) : (
        <>
          {/* Mobile — card list */}
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:hidden">
            {items.map((m) => {
              const title =
                (locale === "fr" ? m.titleFr : m.titleEn) || m.id.slice(0, 8);
              return (
                <li key={m.id} className="min-w-0">
                  <MediaLibraryMobileCard
                    id={m.id}
                    kind={m.kind}
                    mimeType={m.mimeType}
                    title={title}
                    thumbSrc={thumbSrc(m)}
                    visibilityBadge={visibilityBadge(m)}
                    integrityBadge={
                      m.integrity && !m.integrity.ok ? integrityBadge(m) : undefined
                    }
                    groups={groupsFromMedia(m)}
                    locale={locale}
                    busy={busy}
                    openUrl={m.urlOrigin}
                    labels={{
                      edit: t("list.edit"),
                      open: t("media.open"),
                      delete: t("media.delete"),
                    }}
                    onEdit={() => void startEdit(m)}
                    onDelete={() => void remove(m)}
                    onGroupClick={openGroupEdit}
                  />
                </li>
              );
            })}
            {items.length === 0 && (
              <li className="rounded-lg border border-[#d4dde6] bg-white px-4 py-8 text-center text-[#495867]">
                {t("media.empty")}
              </li>
            )}
          </ul>

          {/* Desktop — table */}
          <div className="hidden overflow-hidden rounded-lg border border-[#d4dde6] bg-white md:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#d4dde6] bg-[#f4f7fa]">
              <tr>
                <th className="px-4 py-3 font-medium">{t("media.colPreview")}</th>
                <th className="px-4 py-3 font-medium">{t("media.colTitle")}</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">
                  {t("media.colKind")}
                </th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">
                  {t("media.colVisibility")}
                </th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">
                  {t("media.colIntegrity")}
                </th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">
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
                    <MediaGroupChips
                      groups={groupsFromMedia(m)}
                      locale={locale}
                      onGroupClick={openGroupEdit}
                    />
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">{kindLabel(m.kind)}</td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    {visibilityBadge(m)}
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <div className="space-y-1">
                      {integrityBadge(m)}
                      {m.integrity && !m.integrity.ok && (
                        <MediaIntegrityNotice
                          compact
                          locale={locale}
                          integrity={m.integrity}
                          media={m}
                          onLinkClick={(e) => e.stopPropagation()}
                        />
                      )}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-[#495867] lg:table-cell">
                    {m.posts?.length ?? 0}
                    {m.posts && m.posts.length > 0 && (
                      <div className="mt-0.5 max-w-[12rem] truncate text-[10px] text-[#495867]">
                        {m.posts
                          .map((p) => p.post.titleFr || p.post.slug)
                          .join(", ")}
                      </div>
                    )}
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
        </>
      )}

      <div ref={sentinelRef} className="h-4" aria-hidden />
      {loadingMore && (
        <p className="mt-2 text-center text-sm text-[#495867]">{t("list.loadingMore")}</p>
      )}
    </div>
  );
}
