"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PhotoCanvasEditor } from "./PhotoCanvasEditor";
import { FullscreenEditorModal } from "./FullscreenEditorModal";
import {
  type GalleryEditorImage,
  toEditorImage,
} from "@/lib/gallery-editor";
import {
  DEFAULT_IMAGE_LAYOUT,
  layoutFromLegacy,
  type ImageLayoutParams,
} from "@/lib/image-layout";

type Props = {
  postId: string;
  lang: "fr" | "en";
  mode: "add" | "edit";
  image: GalleryEditorImage | null;
  onClose: () => void;
  onSaved: (image: GalleryEditorImage) => void;
  onDeleted?: (id: string) => void;
};

function emptyDraft(): GalleryEditorImage {
  return {
    id: "",
    kind: "IMAGE",
    mimeType: "image/jpeg",
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

function imageFileFromClipboard(data: DataTransfer | null): File | null {
  if (!data) return null;
  for (const item of data.items) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }
  for (const file of data.files) {
    if (file.type.startsWith("image/")) return file;
  }
  return null;
}

export function PhotoEditModal({
  postId,
  lang,
  mode,
  image,
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

  const queueFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Fichier image requis");
      return;
    }
    setError(null);
    setPendingFile(file);
    setDirty(true);
    setDraft((prev) => prev ?? emptyDraft());
  }, []);

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      if (busy) return;
      const file = imageFileFromClipboard(e.clipboardData);
      if (!file) return;
      e.preventDefault();
      queueFile(file);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [busy, queueFile]);

  function discard() {
    // Do not persist: pending file stays local until Enregistrer.
    setPendingFile(null);
    onClose();
  }

  async function save() {
    if (!draft && !pendingFile) {
      setError("Ajoute d’abord une image");
      return;
    }
    if (!draft?.id && !pendingFile) {
      setError("Ajoute d’abord une image");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      let current = draft ? { ...draft } : emptyDraft();

      if (pendingFile) {
        const body = new FormData();
        body.append("file", pendingFile);
        if (current.id) {
          const res = await fetch(
            `/api/posts/${postId}/images/${current.id}/replace`,
            { method: "POST", body }
          );
          if (!res.ok) throw new Error("replace failed");
          current = toEditorImage(await res.json());
        } else {
          const res = await fetch(`/api/posts/${postId}/images`, {
            method: "POST",
            body,
          });
          if (!res.ok) throw new Error("upload failed");
          current = toEditorImage(await res.json());
        }
        // Keep meta edited locally before upload
        if (draft) {
          current = {
            ...current,
            titleFr: draft.titleFr,
            titleEn: draft.titleEn,
            descriptionFr: draft.descriptionFr,
            descriptionEn: draft.descriptionEn,
            takenAt: draft.takenAt,
            focusX: draft.focusX,
            focusY: draft.focusY,
            zoom: draft.zoom,
            rotation: draft.rotation,
            cropX: draft.cropX,
            cropY: draft.cropY,
            cropW: draft.cropW,
            cropH: draft.cropH,
          };
        }
      }

      if (!current.id) throw new Error("missing id");

      const res = await fetch(`/api/posts/${postId}/images/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titleFr: current.titleFr,
          titleEn: current.titleEn,
          descriptionFr: current.descriptionFr,
          descriptionEn: current.descriptionEn,
          takenAt: current.takenAt
            ? typeof current.takenAt === "string"
              ? current.takenAt
              : current.takenAt.toISOString()
            : null,
          ...layout,
        }),
      });
      if (!res.ok) throw new Error("patch failed");
      const updated = toEditorImage(await res.json());
      setPendingFile(null);
      setDirty(false);
      onSaved(updated);
      onClose();
    } catch {
      setError("Échec de l’enregistrement");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!draft?.id) return;
    if (!confirm("Supprimer cette photo de l’article et de la médiathèque ?")) {
      return;
    }
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
      setError("Échec de la suppression");
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "add" ? "Ajouter une photo" : "Éditer la photo";
  const previewDraft =
    draft && localPreviewUrl
      ? {
          ...draft,
          urlOrigin: localPreviewUrl,
          urlPicto: localPreviewUrl,
          urlPetite: localPreviewUrl,
          urlMoyenne: localPreviewUrl,
          urlGrande: localPreviewUrl,
        }
      : draft;
  const canSave =
    Boolean(draft?.id || pendingFile) && (dirty || Boolean(pendingFile));
  const canvasSrc =
    localPreviewUrl || draft?.urlOrigin || previewDraft?.urlOrigin || "";

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
            Supprimer
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
            Annuler
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy || !canSave}
            className="rounded bg-[#495867] px-4 py-1.5 text-sm text-white hover:bg-[#3a4654] disabled:opacity-50"
          >
            {busy ? "…" : "Enregistrer"}
          </button>
        </>
      }
    >
      <div className="flex h-full min-h-0 flex-col md:flex-row">
        <section className="flex min-h-[42vh] flex-1 items-center justify-center bg-[#eef3f7] md:min-h-0">
          {previewDraft && canvasSrc ? (
            <PhotoCanvasEditor
              imageSrc={canvasSrc}
              value={layout}
              onChange={(next) => {
                setLayout(next);
                setDirty(true);
              }}
              disabled={busy}
              fillStage
              showControls={false}
            />
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
                const file = e.dataTransfer.files?.[0];
                if (file) queueFile(file);
              }}
              className={`mx-4 w-full max-w-md rounded-lg border-2 border-dashed px-4 py-12 text-center ${
                dragOver
                  ? "border-[#495867] bg-white"
                  : "border-[#d4dde6] bg-white/70"
              }`}
            >
              <p className="text-sm text-[#495867]">
                Glisser-déposer, coller (Ctrl/⌘+V), ou
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                className="mt-2 rounded-md border border-[#495867] px-3 py-1.5 text-sm text-[#495867] hover:bg-[#eef3f7] disabled:opacity-50"
              >
                Choisir un fichier
              </button>
            </div>
          )}
        </section>

        <aside className="flex w-full shrink-0 flex-col overflow-y-auto border-t border-[#d4dde6] md:w-[min(100%,24rem)] md:border-l md:border-t-0">
          <div className="space-y-3 p-3 sm:p-4">
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                className="w-full rounded border border-[#d4dde6] px-3 py-1.5 text-sm text-[#495867] hover:bg-[#eef3f7] disabled:opacity-50"
              >
                {draft?.id
                  ? "Remplacer le fichier"
                  : previewDraft
                    ? "Changer de fichier"
                    : "Choisir un fichier"}
              </button>
              {pendingFile && (
                <p className="truncate text-[11px] text-[#495867]">
                  En attente : {pendingFile.name}
                </p>
              )}
              <p className="text-[11px] text-[#495867]">
                Coller Ctrl/⌘+V · rien n’est sauvé avant Enregistrer
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
                <span className="text-[11px] text-[#495867]">Date</span>
                <input
                  type="date"
                  value={
                    draft?.takenAt
                      ? (typeof draft.takenAt === "string"
                          ? draft.takenAt
                          : draft.takenAt.toISOString()
                        ).slice(0, 10)
                      : ""
                  }
                  onChange={(e) =>
                    patchDraft({
                      takenAt: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : null,
                    })
                  }
                  className="mt-0.5 w-full rounded border border-[#d4dde6] px-2 py-1 text-sm"
                />
              </label>
            </div>

            {previewDraft && canvasSrc && (
              <div className="border-t border-[#eef3f7] pt-3">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[#495867]">
                  {lang === "fr" ? "Mise en page" : "Layout"}
                </p>
                <PhotoCanvasEditor
                  imageSrc={canvasSrc}
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
          </div>
        </aside>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
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
