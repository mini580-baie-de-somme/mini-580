"use client";

import { useEffect, useRef, useState } from "react";
import { GalleryImage } from "./GalleryImage";
import {
  type GalleryEditorImage,
  toEditorImage,
} from "@/lib/gallery-editor";

type Props = {
  postId: string;
  lang: "fr" | "en";
  mode: "add" | "edit";
  image: GalleryEditorImage | null;
  onClose: () => void;
  onSaved: (image: GalleryEditorImage) => void;
  onDeleted?: (id: string) => void;
};

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  function patchDraft(patch: Partial<GalleryEditorImage>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
    setDirty(true);
  }

  async function uploadFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Fichier image requis");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (draft?.id) {
        const body = new FormData();
        body.append("file", file);
        const res = await fetch(
          `/api/posts/${postId}/images/${draft.id}/replace`,
          { method: "POST", body }
        );
        if (!res.ok) throw new Error("replace failed");
        const updated = toEditorImage(await res.json());
        setDraft(updated);
        setDirty(false);
        onSaved(updated);
      } else {
        const body = new FormData();
        body.append("file", file);
        const res = await fetch(`/api/posts/${postId}/images`, {
          method: "POST",
          body,
        });
        if (!res.ok) throw new Error("upload failed");
        const created = toEditorImage(await res.json());
        setDraft(created);
        setDirty(false);
        onSaved(created);
      }
    } catch {
      setError("Échec du téléversement vers la médiathèque");
    } finally {
      setBusy(false);
    }
  }

  async function saveMeta() {
    if (!draft?.id) {
      setError("Ajoute d’abord une image");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/posts/${postId}/images/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titleFr: draft.titleFr,
          titleEn: draft.titleEn,
          descriptionFr: draft.descriptionFr,
          descriptionEn: draft.descriptionEn,
          takenAt: draft.takenAt
            ? typeof draft.takenAt === "string"
              ? draft.takenAt
              : draft.takenAt.toISOString()
            : null,
          focusX: draft.focusX,
          focusY: draft.focusY,
          zoom: draft.zoom,
          rotation: draft.rotation,
          cropX: draft.cropX,
          cropY: draft.cropY,
          cropW: draft.cropW,
          cropH: draft.cropH,
        }),
      });
      if (!res.ok) throw new Error("patch failed");
      const updated = toEditorImage(await res.json());
      setDraft(updated);
      setDirty(false);
      onSaved(updated);
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

  async function handleClose() {
    if (dirty && draft?.id) {
      await saveMeta();
    }
    onClose();
  }

  const title = mode === "add" ? "Ajouter une photo" : "Éditer la photo";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-[#0D131A]/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) void handleClose();
      }}
    >
      <div className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-xl bg-white shadow-xl sm:rounded-xl">
        <div className="flex items-center justify-between border-b border-[#d4dde6] px-4 py-3">
          <h2 className="text-base font-semibold text-[#0D131A]">{title}</h2>
          <button
            type="button"
            onClick={() => void handleClose()}
            disabled={busy}
            className="rounded border border-[#d4dde6] px-3 py-1 text-sm text-[#495867] hover:bg-[#eef3f7] disabled:opacity-50"
          >
            Fermer
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {busy && <p className="text-xs text-[#495867]">Enregistrement…</p>}

          {!draft && (
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
                if (file) void uploadFile(file);
              }}
              className={`rounded-lg border-2 border-dashed px-4 py-10 text-center ${
                dragOver
                  ? "border-[#495867] bg-[#eef3f7]"
                  : "border-[#d4dde6] bg-[#fafbfc]"
              }`}
            >
              <p className="text-sm text-[#495867]">
                Glisser-déposer une image, ou
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                className="mt-2 rounded-md border border-[#495867] px-3 py-1.5 text-sm text-[#495867] hover:bg-white disabled:opacity-50"
              >
                Choisir un fichier
              </button>
              <p className="mt-2 text-xs text-[#495867]">
                L’image est enregistrée dans la médiathèque et liée à cet article.
              </p>
            </div>
          )}

          {draft && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <GalleryImage image={draft} locale={lang} mode="edit" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                  className="w-full rounded border border-[#d4dde6] px-3 py-1.5 text-sm text-[#495867] hover:bg-[#eef3f7] disabled:opacity-50"
                >
                  Remplacer le fichier
                </button>
              </div>

              <div className="space-y-3 text-sm">
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs text-[#495867]">Titre FR</span>
                    <input
                      value={draft.titleFr}
                      onChange={(e) => patchDraft({ titleFr: e.target.value })}
                      className="mt-0.5 w-full rounded border border-[#d4dde6] px-2 py-1"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-[#495867]">Title EN</span>
                    <input
                      value={draft.titleEn}
                      onChange={(e) => patchDraft({ titleEn: e.target.value })}
                      className="mt-0.5 w-full rounded border border-[#d4dde6] px-2 py-1"
                    />
                  </label>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs text-[#495867]">Description FR</span>
                    <textarea
                      value={draft.descriptionFr}
                      onChange={(e) =>
                        patchDraft({ descriptionFr: e.target.value })
                      }
                      rows={2}
                      className="mt-0.5 w-full rounded border border-[#d4dde6] px-2 py-1"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-[#495867]">Description EN</span>
                    <textarea
                      value={draft.descriptionEn}
                      onChange={(e) =>
                        patchDraft({ descriptionEn: e.target.value })
                      }
                      rows={2}
                      className="mt-0.5 w-full rounded border border-[#d4dde6] px-2 py-1"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="text-xs text-[#495867]">Date</span>
                  <input
                    type="date"
                    value={
                      draft.takenAt
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
                    className="mt-0.5 w-full rounded border border-[#d4dde6] px-2 py-1"
                  />
                </label>

                <fieldset className="space-y-2 rounded border border-[#d4dde6] p-3">
                  <legend className="px-1 text-xs font-medium text-[#495867]">
                    Transform
                  </legend>
                  <label className="flex items-center gap-2">
                    <span className="w-20 text-xs">Focus X</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={draft.focusX}
                      onChange={(e) =>
                        patchDraft({ focusX: Number(e.target.value) })
                      }
                      className="flex-1"
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="w-20 text-xs">Focus Y</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={draft.focusY}
                      onChange={(e) =>
                        patchDraft({ focusY: Number(e.target.value) })
                      }
                      className="flex-1"
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="w-20 text-xs">Zoom</span>
                    <input
                      type="range"
                      min={0.5}
                      max={3}
                      step={0.05}
                      value={draft.zoom}
                      onChange={(e) =>
                        patchDraft({ zoom: Number(e.target.value) })
                      }
                      className="flex-1"
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="w-20 text-xs">Rotation</span>
                    <select
                      value={draft.rotation}
                      onChange={(e) =>
                        patchDraft({ rotation: Number(e.target.value) })
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
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        ["cropX", draft.cropX],
                        ["cropY", draft.cropY],
                        ["cropW", draft.cropW],
                        ["cropH", draft.cropH],
                      ] as const
                    ).map(([key, val]) => (
                      <label key={key} className="flex items-center gap-1">
                        <span className="w-12 text-[10px] uppercase text-[#495867]">
                          {key.replace("crop", "")}
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={1}
                          step={0.01}
                          value={val}
                          onChange={(e) =>
                            patchDraft({ [key]: Number(e.target.value) })
                          }
                          className="w-full rounded border border-[#d4dde6] px-1 py-0.5 text-xs"
                        />
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadFile(file);
              e.target.value = "";
            }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#d4dde6] px-4 py-3">
          <div>
            {draft?.id && (
              <button
                type="button"
                onClick={() => void remove()}
                disabled={busy}
                className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                Supprimer
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleClose()}
              disabled={busy}
              className="rounded border border-[#d4dde6] px-3 py-1.5 text-sm text-[#495867] hover:bg-[#eef3f7] disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => void saveMeta()}
              disabled={busy || !draft?.id || !dirty}
              className="rounded bg-[#495867] px-4 py-1.5 text-sm text-white hover:bg-[#3a4654] disabled:opacity-50"
            >
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
