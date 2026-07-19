"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DatetimeLocalInput } from "./DatetimeLocalInput";
import { EditorSheetPanel } from "./EditorSheetPanel";
import { PhotoCanvasEditor } from "./PhotoCanvasEditor";
import { FullscreenEditorModal } from "./FullscreenEditorModal";
import { MediaPreview } from "./MediaPreview";
import {
  type GalleryEditorImage,
  toEditorImage,
} from "@/lib/gallery-editor";
import {
  DEFAULT_IMAGE_LAYOUT,
  layoutFromLegacy,
  type ImageLayoutParams,
} from "@/lib/image-layout";
import {
  MEDIA_ACCEPT,
  isAllowedMediaFile,
  kindFromFile,
  mediaFileFromDataTransfer,
  resolveFileMime,
  type ClipboardPasteError,
  type MediaKindClient,
} from "@/lib/media-file-client";
import { isLocalMediaUrl } from "@/lib/media-integrity-shared";
import {
  formatMaxMb,
  maxBytesForMime,
  MEDIA_MAX_BYTES,
  MEDIA_VIDEO_MAX_BYTES,
} from "@/lib/media-limits";
import {
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "@/lib/utils";
import {
  newPhotoEditorTraceId,
  photoEditorTrace,
  readApiErrorBody,
} from "@/lib/media-trace-client";
import type { MediaIntegrity } from "@/lib/media-integrity-types";
import { MediaIntegrityNotice } from "./MediaIntegrityNotice";
import { MediaClipboardPasteButton } from "./MediaClipboardPasteButton";

type Props = {
  postId: string;
  lang: "fr" | "en";
  mode: "add" | "edit";
  image: GalleryEditorImage | null;
  /** Cover picker — images only. Post gallery allows photo/PDF/video. */
  imagesOnly?: boolean;
  onClose: () => void;
  onSaved: (image: GalleryEditorImage) => void;
  onDeleted?: (id: string) => void;
};

function emptyDraft(kind: MediaKindClient = "IMAGE"): GalleryEditorImage {
  return {
    id: "",
    kind,
    mimeType:
      kind === "VIDEO"
        ? "video/mp4"
        : kind === "DOCUMENT"
          ? "application/pdf"
          : "image/jpeg",
    urlOrigin: "",
    urlPicto: null,
    urlPetite: null,
    urlMoyenne: null,
    urlGrande: null,
    titleFr: "",
    titleEn: "",
    descriptionFr: "",
    descriptionEn: "",
    takenAt: null,
    sortOrder: 0,
    offsetX: 0,
    offsetY: 0,
    scaleX: 1,
    scaleY: 1,
    lockAspect: true,
    cropShape: "RECT",
    backgroundColor: "#000000",
    cropInset: 0.06,
    focusX: 0.5,
    focusY: 0.5,
    zoom: 1,
    rotation: 0,
    cropX: 0,
    cropY: 0,
    cropW: 1,
    cropH: 1,
  };
}

function sizeLimitsHint(lang: "fr" | "en"): string {
  const photo = formatMaxMb(MEDIA_MAX_BYTES);
  const video = formatMaxMb(MEDIA_VIDEO_MAX_BYTES);
  return lang === "fr"
    ? `Limites : photos & PDF ${photo} Mo · vidéos ${video} Mo.`
    : `Limits: photos & PDF ${photo} MB · videos ${video} MB.`;
}

function pasteClipboardErrorMessage(
  error: ClipboardPasteError,
  lang: "fr" | "en"
): string {
  const messages: Record<ClipboardPasteError, { fr: string; en: string }> = {
    unsupported: {
      fr: "Collage depuis le presse-papiers non disponible sur ce navigateur.",
      en: "Clipboard paste is not available in this browser.",
    },
    empty: {
      fr: "Aucune image dans le presse-papiers.",
      en: "No image in the clipboard.",
    },
    permission: {
      fr: "Accès au presse-papiers refusé — autorise-le dans le navigateur.",
      en: "Clipboard access denied — allow it in your browser.",
    },
    not_image: {
      fr: "Le presse-papiers contient du texte ou une URL, pas une image — copie la photo elle-même.",
      en: "The clipboard holds text or a URL, not an image — copy the photo itself.",
    },
  };
  return messages[error][lang];
}

function assertLocalOriginResponse(
  urlOrigin: string | null | undefined,
  lang: "fr" | "en"
): void {
  if (!urlOrigin || !isLocalMediaUrl(urlOrigin)) {
    throw new Error(
      lang === "fr"
        ? "Le fichier n’a pas été enregistré dans le stockage local /media."
        : "File was not saved to local /media storage."
    );
  }
}

export function PhotoEditModal({
  postId,
  lang,
  mode,
  image,
  imagesOnly = false,
  onClose,
  onSaved,
  onDeleted,
}: Props) {
  const [draft, setDraft] = useState<GalleryEditorImage | null>(
    mode === "edit" && image ? { ...image } : null
  );
  const [layout, setLayout] = useState<ImageLayoutParams>(() =>
    mode === "edit" && image
      ? layoutFromLegacy(image)
      : { ...DEFAULT_IMAGE_LAYOUT }
  );
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [originEditable, setOriginEditable] = useState(true);
  const [mediaIntegrity, setMediaIntegrity] = useState<MediaIntegrity | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!pendingFile) {
      setLocalPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    setLocalPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  useEffect(() => {
    if (mode !== "edit" || !draft?.id || pendingFile) {
      setOriginEditable(true);
      setMediaIntegrity(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/media-library/${draft.id}`);
        if (!res.ok || cancelled) return;
        const full = (await res.json()) as GalleryEditorImage & {
          integrity?: MediaIntegrity;
        };
        if (cancelled) return;
        const editable = full.integrity?.editable ?? false;
        setOriginEditable(editable);
        setMediaIntegrity(full.integrity ?? null);
        if (!editable) {
          setError(
            lang === "fr"
              ? "Original absent du stockage local — remplace le fichier avant d’éditer le cadrage."
              : "Original missing from local storage — replace the file before editing layout."
          );
        }
      } catch {
        if (!cancelled) setOriginEditable(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, draft?.id, pendingFile, lang]);

  function patchDraft(patch: Partial<GalleryEditorImage>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
    setDirty(true);
  }

  const queueFile = useCallback(
    (file: File) => {
      if (imagesOnly) {
        if (!file.type.startsWith("image/")) {
          setError(
            lang === "fr"
              ? "La couverture doit être une photo."
              : "Cover must be a photo."
          );
          return;
        }
      } else if (!isAllowedMediaFile(file)) {
        setError(
          lang === "fr"
            ? "Type non supporté. Photo, PDF, MP4 ou WebM uniquement."
            : "Unsupported type. Photo, PDF, MP4 or WebM only."
        );
        return;
      }

      const mime = resolveFileMime(file) ?? file.type;
      const max = maxBytesForMime(mime);
      if (file.size > max) {
        const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
        const maxMb = formatMaxMb(max);
        setError(
          mime.startsWith("video/")
            ? lang === "fr"
              ? `Cette vidéo fait ${sizeMb} Mo. Les vidéos sont limitées à ${maxMb} Mo.`
              : `This video is ${sizeMb} MB. Videos are limited to ${maxMb} MB.`
            : lang === "fr"
              ? `Fichier trop volumineux (${sizeMb} Mo). Maximum : ${maxMb} Mo.`
              : `File too large (${sizeMb} MB). Maximum: ${maxMb} MB.`
        );
        return;
      }

      const kind = kindFromFile(file) ?? "IMAGE";
      setError(null);
      setPendingFile(file);
      setDirty(true);
      setOriginEditable(true);
      setMediaIntegrity(null);
      setDraft((prev) => {
        const base = prev ?? emptyDraft(kind);
        return {
          ...base,
          kind,
          mimeType: mime,
        };
      });
    },
    [imagesOnly, lang]
  );

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      if (busy) return;
      const file = imagesOnly
        ? (() => {
            const data = e.clipboardData;
            if (!data) return null;
            for (const item of data.items) {
              if (item.type.startsWith("image/")) {
                const f = item.getAsFile();
                if (f) return f;
              }
            }
            return null;
          })()
        : mediaFileFromDataTransfer(e.clipboardData);
      if (!file) return;
      e.preventDefault();
      queueFile(file);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [busy, imagesOnly, queueFile]);

  function discard() {
    setPendingFile(null);
    onClose();
  }

  const effectiveKind: MediaKindClient = useMemo(() => {
    if (pendingFile) return kindFromFile(pendingFile) ?? "IMAGE";
    const k = draft?.kind;
    if (k === "DOCUMENT" || k === "VIDEO" || k === "IMAGE") return k;
    return "IMAGE";
  }, [pendingFile, draft?.kind]);

  const isImage = effectiveKind === "IMAGE";
  const canEditImageLayout = isImage && (Boolean(pendingFile) || originEditable);

  async function save() {
    if (!draft && !pendingFile) {
      setError(
        lang === "fr"
          ? "Ajoute d’abord un fichier."
          : "Add a file first."
      );
      return;
    }
    if (!draft?.id && !pendingFile) {
      setError(
        lang === "fr"
          ? "Ajoute d’abord un fichier."
          : "Add a file first."
      );
      return;
    }

    setBusy(true);
    setError(null);
    const trace = { traceId: newPhotoEditorTraceId(), postId, mediaId: draft?.id };
    photoEditorTrace(trace, "save.start", {
      mode,
      isImage,
      hasPendingFile: Boolean(pendingFile),
      layout: isImage ? layout : undefined,
    });
    try {
      let current = draft ? { ...draft } : emptyDraft(effectiveKind);

      if (pendingFile) {
        const body = new FormData();
        body.append("file", pendingFile);
        body.append("titleFr", current.titleFr);
        body.append("titleEn", current.titleEn);
        body.append("descriptionFr", current.descriptionFr);
        body.append("descriptionEn", current.descriptionEn);
        if (current.takenAt) {
          const iso =
            typeof current.takenAt === "string"
              ? current.takenAt
              : current.takenAt.toISOString();
          body.append("takenAt", iso);
        }

        if (current.id) {
          photoEditorTrace(trace, "save.replace.start", { mediaId: current.id });
          const rep = await fetch(`/api/media-library/${current.id}/replace`, {
            method: "POST",
            body,
          });
          if (!rep.ok) {
            const errBody = await readApiErrorBody(rep);
            photoEditorTrace(trace, "save.replace.failed", {
              status: rep.status,
              ...errBody,
            });
            throw new Error(
              typeof errBody.detail === "string"
                ? errBody.detail
                : "replace failed"
            );
          }
          current = toEditorImage(await rep.json());
          assertLocalOriginResponse(current.urlOrigin, lang);
          photoEditorTrace(trace, "save.replace.done", { mediaId: current.id });
        } else {
          photoEditorTrace(trace, "save.upload.start", { postId });
          const res = await fetch(`/api/posts/${postId}/media`, {
            method: "POST",
            body,
          });
          if (!res.ok) {
            const errBody = await readApiErrorBody(res);
            photoEditorTrace(trace, "save.upload.failed", {
              status: res.status,
              ...errBody,
            });
            throw new Error("upload failed");
          }
          current = toEditorImage(await res.json());
          assertLocalOriginResponse(current.urlOrigin, lang);
          photoEditorTrace(trace, "save.upload.done", { mediaId: current.id });
        }

        if (draft) {
          current = {
            ...current,
            titleFr: draft.titleFr,
            titleEn: draft.titleEn,
            descriptionFr: draft.descriptionFr,
            descriptionEn: draft.descriptionEn,
            takenAt: draft.takenAt,
          };
        }
      }

      if (!current.id) throw new Error("missing id");
      trace.mediaId = current.id;

      const patchBody: Record<string, unknown> = {
        titleFr: current.titleFr,
        titleEn: current.titleEn,
        descriptionFr: current.descriptionFr,
        descriptionEn: current.descriptionEn,
        takenAt: current.takenAt
          ? typeof current.takenAt === "string"
            ? current.takenAt
            : current.takenAt.toISOString()
          : null,
      };
      if (isImage && canEditImageLayout) {
        Object.assign(patchBody, layout);
      }

      photoEditorTrace(trace, "save.patch.start", {
        mediaId: current.id,
        patchBody,
      });
      const res = await fetch(`/api/posts/${postId}/images/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      });
      if (!res.ok) {
        const errBody = await readApiErrorBody(res);
        photoEditorTrace(trace, "save.patch.failed", {
          status: res.status,
          ...errBody,
        });
        const detail =
          typeof errBody.detail === "string" ? errBody.detail : undefined;
        const serverTrace =
          typeof errBody.traceId === "string" ? errBody.traceId : trace.traceId;
        throw new Error(
          detail
            ? `${detail} (${serverTrace})`
            : `patch failed (${serverTrace})`
        );
      }
      const updated = toEditorImage(await res.json());
      photoEditorTrace(trace, "save.patch.done", {
        mediaId: current.id,
        scaleX: updated.scaleX,
        scaleY: updated.scaleY,
        rotation: updated.rotation,
      });
      const saved: GalleryEditorImage = isImage
        ? {
            ...updated,
            offsetX: layout.offsetX,
            offsetY: layout.offsetY,
            scaleX: layout.scaleX,
            scaleY: layout.scaleY,
            lockAspect: layout.lockAspect,
            rotation: layout.rotation,
            cropShape: layout.cropShape,
            backgroundColor: layout.backgroundColor,
            cropInset: layout.cropInset,
            focusX: 0.5 - layout.offsetX / 2,
            focusY: 0.5 - layout.offsetY / 2,
            zoom: layout.lockAspect
              ? layout.scaleX
              : Math.max(layout.scaleX, layout.scaleY),
          }
        : updated;
      setPendingFile(null);
      setDirty(false);
      onSaved(saved);
      onClose();
      photoEditorTrace(trace, "save.done", { mediaId: saved.id });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed";
      photoEditorTrace(trace, "save.error", { message });
      setError(
        lang === "fr"
          ? message.startsWith("Échec")
            ? message
            : `Échec de l'enregistrement — ${message}`
          : message.startsWith("Save failed")
            ? message
            : `Save failed — ${message}`
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!draft?.id) return;
    const msg =
      lang === "fr"
        ? "Supprimer ce média de l’article et de la médiathèque ?"
        : "Remove this media from the post and library?";
    if (!confirm(msg)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/posts/${postId}/images/${draft.id}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) throw new Error("delete failed");
      onDeleted?.(draft.id);
      onClose();
    } catch {
      setError(lang === "fr" ? "Échec de la suppression" : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  const title =
    mode === "add"
      ? imagesOnly
        ? lang === "fr"
          ? "Ajouter une couverture"
          : "Add cover"
        : lang === "fr"
          ? "Ajouter un média"
          : "Add media"
      : imagesOnly
        ? lang === "fr"
          ? "Éditer la couverture"
          : "Edit cover"
        : lang === "fr"
          ? "Éditer le média"
          : "Edit media";

  const previewSrc =
    localPreviewUrl ||
    draft?.urlOrigin ||
    draft?.urlMoyenne ||
    draft?.urlGrande ||
    "";
  const hasPreview = Boolean(draft || pendingFile) && Boolean(previewSrc);
  const canSave =
    Boolean(draft?.id || pendingFile) && (dirty || Boolean(pendingFile));

  const acceptAttr = imagesOnly
    ? "image/jpeg,image/png,image/webp,image/gif"
    : MEDIA_ACCEPT;

  return (
    <FullscreenEditorModal
      title={title}
      onClose={discard}
      busy={busy}
      error={error}
      footerLeft={
        draft?.id ? (
          <button
            type="button"
            onClick={() => void remove()}
            disabled={busy}
            className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {lang === "fr" ? "Supprimer" : "Delete"}
          </button>
        ) : null
      }
      footerRight={
        <>
          <button
            type="button"
            onClick={discard}
            disabled={busy}
            className="rounded border border-[#d4dde6] px-3 py-1.5 text-sm text-[#495867] hover:bg-[#eef3f7] disabled:opacity-50"
          >
            {lang === "fr" ? "Annuler" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy || !canSave}
            className="rounded bg-[#495867] px-4 py-1.5 text-sm text-white hover:bg-[#3a4654] disabled:opacity-50"
          >
            {busy ? "…" : lang === "fr" ? "Enregistrer" : "Save"}
          </button>
        </>
      }
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden md:flex-row">
        <section
          className={`flex min-h-0 flex-1 overflow-hidden bg-[#eef3f7] md:min-h-0 md:flex-1 md:shrink ${
            hasPreview && canEditImageLayout
              ? "min-h-[24vh] touch-none items-center justify-center md:h-auto md:max-h-none md:min-h-0"
              : hasPreview
                ? "min-h-[24vh] items-stretch p-0 md:h-auto md:max-h-none md:min-h-0"
                : "min-h-[28vh] items-center justify-center md:min-h-0"
          }`}
        >
          {hasPreview && canEditImageLayout ? (
            <PhotoCanvasEditor
              imageSrc={previewSrc}
              value={layout}
              onChange={(next) => {
                setLayout(next);
                setDirty(true);
              }}
              disabled={busy}
              fillStage
              showControls={false}
            />
          ) : hasPreview ? (
            <div className="flex h-full min-h-0 w-full flex-col p-2 sm:p-3">
              {isImage && !canEditImageLayout && (
                <MediaIntegrityNotice
                  panel
                  locale={lang}
                  integrity={mediaIntegrity}
                  media={
                    draft
                      ? {
                          urlOrigin: draft.urlOrigin,
                          urlPicto: draft.urlPicto,
                          urlPetite: draft.urlPetite,
                          urlMoyenne: draft.urlMoyenne,
                          urlGrande: draft.urlGrande,
                        }
                      : null
                  }
                  message={
                    lang === "fr"
                      ? "Original absent du stockage local — remplace le fichier avant d’éditer le cadrage."
                      : "Original missing from local storage — replace the file before editing layout."
                  }
                  className="mb-2"
                />
              )}
              <MediaPreview
                kind={effectiveKind}
                src={previewSrc}
                title={
                  (lang === "fr" ? draft?.titleFr : draft?.titleEn) ||
                  pendingFile?.name
                }
                openLabel={lang === "fr" ? "Ouvrir" : "Open"}
                fill
              />
            </div>
          ) : (
            <div
              ref={dropRef}
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
                const file = imagesOnly
                  ? e.dataTransfer.files?.[0]
                  : mediaFileFromDataTransfer(e.dataTransfer);
                if (file) queueFile(file);
              }}
              className={`mx-4 w-full max-w-md rounded-lg border-2 border-dashed px-4 py-12 text-center ${
                dragOver
                  ? "border-[#495867] bg-white"
                  : "border-[#d4dde6] bg-white/70"
              }`}
            >
              <p className="text-sm text-[#495867]">
                {imagesOnly
                  ? lang === "fr"
                    ? "Glisser-déposer une photo, coller, ou"
                    : "Drag-drop a photo, paste, or"
                  : lang === "fr"
                    ? "Glisser-déposer photo / PDF / vidéo, coller, ou"
                    : "Drag-drop photo / PDF / video, paste, or"}
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                className="mt-2 rounded-md border border-[#495867] px-3 py-1.5 text-sm text-[#495867] hover:bg-[#eef3f7] disabled:opacity-50"
              >
                {lang === "fr" ? "Choisir un fichier" : "Choose a file"}
              </button>
              {!imagesOnly && (
                <p className="mt-2 text-xs text-[#495867]">
                  {sizeLimitsHint(lang)}
                </p>
              )}
            </div>
          )}
        </section>

        <EditorSheetPanel
          handleLabel={
            lang === "fr"
              ? "Redimensionner le panneau de saisie"
              : "Resize input panel"
          }
          className="md:w-[min(100%,24rem)] md:flex-none md:shrink-0 md:border-l md:border-t-0"
        >
          <div className="flex flex-col gap-3 p-3 sm:p-4">
            {hasPreview && canEditImageLayout && (
              <div className="order-first border-b border-[#eef3f7] pb-3 md:order-last md:border-b-0 md:border-t md:pt-3 md:pb-0">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[#495867]">
                  {lang === "fr" ? "Mise en page" : "Layout"}
                </p>
                <PhotoCanvasEditor
                  imageSrc={previewSrc}
                  value={layout}
                  onChange={(next) => {
                    setLayout(next);
                    setDirty(true);
                  }}
                  disabled={busy}
                  showStage={false}
                />
              </div>
            )}

            <div className="order-last space-y-3 md:order-first">
              <div className="space-y-1.5">
              {!imagesOnly && (
                <p className="rounded-md bg-[#eef3f7] px-2.5 py-1.5 text-[11px] leading-snug text-[#495867]">
                  {sizeLimitsHint(lang)}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                  className="min-h-[44px] flex-1 rounded border border-[#d4dde6] px-3 py-1.5 text-sm text-[#495867] hover:bg-[#eef3f7] disabled:opacity-50"
                >
                  {draft?.id
                    ? lang === "fr"
                      ? "Remplacer le fichier"
                      : "Replace file"
                    : hasPreview
                      ? lang === "fr"
                        ? "Changer de fichier"
                        : "Change file"
                      : lang === "fr"
                        ? "Choisir un fichier"
                        : "Choose a file"}
                </button>
                <MediaClipboardPasteButton
                  disabled={busy}
                  label={lang === "fr" ? "Coller" : "Paste"}
                  onFile={queueFile}
                  onError={(message) => setError(message)}
                  errorMessage={(error) => pasteClipboardErrorMessage(error, lang)}
                />
              </div>
              {pendingFile && (
                <p className="truncate text-[11px] text-[#495867]">
                  {lang === "fr" ? "En attente" : "Pending"}: {pendingFile.name}
                  {" · "}
                  {lang === "fr"
                    ? "sera stockée localement à l’enregistrement"
                    : "will be stored locally on save"}
                </p>
              )}
              <p className="text-[11px] text-[#495867]">
                {lang === "fr"
                  ? `Type : ${effectiveKind} · rien n’est sauvé avant Enregistrer`
                  : `Type: ${effectiveKind} · nothing saved until Save`}
              </p>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex gap-2">
                <label className="block min-w-0 flex-1">
                  <span className="text-[11px] text-[#495867]">Titre FR</span>
                  <input
                    value={draft?.titleFr ?? ""}
                    onChange={(e) => patchDraft({ titleFr: e.target.value })}
                    className="mt-0.5 w-full rounded border border-[#d4dde6] px-2 py-1 text-sm"
                  />
                </label>
                <label className="block min-w-0 flex-1">
                  <span className="text-[11px] text-[#495867]">Title EN</span>
                  <input
                    value={draft?.titleEn ?? ""}
                    onChange={(e) => patchDraft({ titleEn: e.target.value })}
                    className="mt-0.5 w-full rounded border border-[#d4dde6] px-2 py-1 text-sm"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-[11px] text-[#495867]">Description FR</span>
                <textarea
                  value={draft?.descriptionFr ?? ""}
                  onChange={(e) =>
                    patchDraft({ descriptionFr: e.target.value })
                  }
                  rows={4}
                  className="mt-0.5 min-h-[5.5rem] w-full rounded border border-[#d4dde6] px-2 py-1 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-[#495867]">Description EN</span>
                <textarea
                  value={draft?.descriptionEn ?? ""}
                  onChange={(e) =>
                    patchDraft({ descriptionEn: e.target.value })
                  }
                  rows={4}
                  className="mt-0.5 min-h-[5.5rem] w-full rounded border border-[#d4dde6] px-2 py-1 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-[#495867]">
                  {lang === "fr"
                    ? "Date (galerie / chronologie)"
                    : "Date (gallery / chronology)"}
                </span>
                <DatetimeLocalInput
                  value={toDatetimeLocalValue(draft?.takenAt)}
                  onChange={(value) =>
                    patchDraft({
                      takenAt: fromDatetimeLocalValue(value),
                    })
                  }
                />
                <span className="mt-1 block text-[10px] text-[#495867]">
                  {lang === "fr"
                    ? "Permet de dater le média pour l'ordre dans la galerie."
                    : "Backdate the media for gallery ordering."}
                </span>
              </label>
            </div>
            </div>
          </div>
        </EditorSheetPanel>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={acceptAttr}
        capture={imagesOnly ? "environment" : undefined}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) queueFile(file);
          e.target.value = "";
        }}
      />
    </FullscreenEditorModal>
  );
}
