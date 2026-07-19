"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  type MediaKindClient,
} from "@/lib/media-file-client";
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
          // Library replace handles image bake and PDF/video put
          const rep = await fetch(`/api/media-library/${current.id}/replace`, {
            method: "POST",
            body,
          });
          if (!rep.ok) throw new Error("replace failed");
          current = toEditorImage(await rep.json());
        } else {
          // Post media create accepts all kinds
          const res = await fetch(`/api/posts/${postId}/media`, {
            method: "POST",
            body,
          });
          if (!res.ok) throw new Error("upload failed");
          current = toEditorImage(await res.json());
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
      if (isImage) {
        Object.assign(patchBody, layout);
      }

      const res = await fetch(`/api/posts/${postId}/images/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      });
      if (!res.ok) throw new Error("patch failed");
      const updated = toEditorImage(await res.json());
      setPendingFile(null);
      setDirty(false);
      onSaved(updated);
      onClose();
    } catch {
      setError(
        lang === "fr"
          ? "Échec de l’enregistrement"
          : "Save failed"
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
      <div className="flex h-full min-h-0 flex-col md:flex-row">
        <section
          className={`flex min-h-[42vh] flex-1 bg-[#eef3f7] md:min-h-0 ${
            hasPreview && isImage
              ? "items-center justify-center"
              : hasPreview
                ? "min-h-0 items-stretch p-0"
                : "items-center justify-center"
          }`}
        >
          {hasPreview && isImage ? (
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
            <div className="flex h-full min-h-0 w-full p-2 sm:p-3">
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

        <aside className="flex w-full shrink-0 flex-col overflow-y-auto border-t border-[#d4dde6] md:w-[min(100%,24rem)] md:border-l md:border-t-0">
          <div className="flex flex-col gap-3 p-3 sm:p-4">
            {hasPreview && isImage && (
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
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                className="w-full rounded border border-[#d4dde6] px-3 py-1.5 text-sm text-[#495867] hover:bg-[#eef3f7] disabled:opacity-50"
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
              {pendingFile && (
                <p className="truncate text-[11px] text-[#495867]">
                  {lang === "fr" ? "En attente" : "Pending"}: {pendingFile.name}
                </p>
              )}
              <p className="text-[11px] text-[#495867]">
                {lang === "fr"
                  ? `Type : ${effectiveKind} · rien n’est sauvé avant Enregistrer`
                  : `Type: ${effectiveKind} · nothing saved until Save`}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <label className="block">
                <span className="text-[11px] text-[#495867]">Titre FR</span>
                <input
                  value={draft?.titleFr ?? ""}
                  onChange={(e) => patchDraft({ titleFr: e.target.value })}
                  className="mt-0.5 w-full rounded border border-[#d4dde6] px-2 py-1 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-[#495867]">Title EN</span>
                <input
                  value={draft?.titleEn ?? ""}
                  onChange={(e) => patchDraft({ titleEn: e.target.value })}
                  className="mt-0.5 w-full rounded border border-[#d4dde6] px-2 py-1 text-sm"
                />
              </label>
              <label className="col-span-2 block">
                <span className="text-[11px] text-[#495867]">Description FR</span>
                <textarea
                  value={draft?.descriptionFr ?? ""}
                  onChange={(e) =>
                    patchDraft({ descriptionFr: e.target.value })
                  }
                  rows={2}
                  className="mt-0.5 w-full rounded border border-[#d4dde6] px-2 py-1 text-sm"
                />
              </label>
              <label className="col-span-2 block">
                <span className="text-[11px] text-[#495867]">Description EN</span>
                <textarea
                  value={draft?.descriptionEn ?? ""}
                  onChange={(e) =>
                    patchDraft({ descriptionEn: e.target.value })
                  }
                  rows={2}
                  className="mt-0.5 w-full rounded border border-[#d4dde6] px-2 py-1 text-sm"
                />
              </label>
              <label className="col-span-2 block">
                <span className="text-[11px] text-[#495867]">
                  {lang === "fr"
                    ? "Date (galerie / chronologie)"
                    : "Date (gallery / chronology)"}
                </span>
                <input
                  type="datetime-local"
                  value={toDatetimeLocalValue(draft?.takenAt)}
                  onChange={(e) =>
                    patchDraft({
                      takenAt: fromDatetimeLocalValue(e.target.value),
                    })
                  }
                  className="mt-0.5 w-full rounded border border-[#d4dde6] px-2 py-1 text-sm"
                />
                <span className="mt-1 block text-[10px] text-[#495867]">
                  {lang === "fr"
                    ? "Permet de rétro-dater le média pour l’ordre en galerie."
                    : "Backdate the media for gallery ordering."}
                </span>
              </label>
            </div>
            </div>
          </div>
        </aside>
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
