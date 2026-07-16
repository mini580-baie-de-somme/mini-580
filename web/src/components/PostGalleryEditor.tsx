"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GalleryImage } from "./GalleryImage";

export type GalleryEditorImage = {
  id: string;
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
  sortOrder: number;
  focusX: number;
  focusY: number;
  zoom: number;
  rotation: number;
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
};

type Props = {
  postId: string;
  lang: "fr" | "en";
  initialImages: GalleryEditorImage[];
};

function toEditorImage(raw: Record<string, unknown>): GalleryEditorImage {
  return {
    id: String(raw.id),
    urlOrigin: String(raw.urlOrigin ?? raw.url ?? ""),
    urlPicto: (raw.urlPicto as string | null) ?? null,
    urlPetite: (raw.urlPetite as string | null) ?? null,
    urlMoyenne: (raw.urlMoyenne as string | null) ?? null,
    urlGrande: (raw.urlGrande as string | null) ?? null,
    titleFr: String(raw.titleFr ?? ""),
    titleEn: String(raw.titleEn ?? ""),
    descriptionFr: String(raw.descriptionFr ?? raw.captionFr ?? ""),
    descriptionEn: String(raw.descriptionEn ?? raw.captionEn ?? ""),
    takenAt: raw.takenAt
      ? new Date(String(raw.takenAt)).toISOString()
      : null,
    sortOrder: Number(raw.sortOrder ?? 0),
    focusX: Number(raw.focusX ?? 0.5),
    focusY: Number(raw.focusY ?? 0.5),
    zoom: Number(raw.zoom ?? 1),
    rotation: Number(raw.rotation ?? 0),
    cropX: Number(raw.cropX ?? 0),
    cropY: Number(raw.cropY ?? 0),
    cropW: Number(raw.cropW ?? 1),
    cropH: Number(raw.cropH ?? 1),
  };
}

export function PostGalleryEditor({ postId, lang, initialImages }: Props) {
  const [images, setImages] = useState<GalleryEditorImage[]>(initialImages);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialImages[0]?.id ?? null
  );
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const dropRef = useRef<HTMLDivElement>(null);

  const selected = images.find((i) => i.id === selectedId) ?? null;

  useEffect(() => {
    setImages(initialImages);
    if (!selectedId && initialImages[0]) setSelectedId(initialImages[0].id);
  }, [initialImages, selectedId]);

  const patchImage = useCallback(
    async (id: string, patch: Partial<GalleryEditorImage>) => {
      setImages((prev) =>
        prev.map((img) => (img.id === id ? { ...img, ...patch } : img))
      );
      const existing = saveTimers.current.get(id);
      if (existing) clearTimeout(existing);
      saveTimers.current.set(
        id,
        setTimeout(async () => {
          try {
            const res = await fetch(`/api/posts/${postId}/images/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                titleFr: patch.titleFr,
                titleEn: patch.titleEn,
                descriptionFr: patch.descriptionFr,
                descriptionEn: patch.descriptionEn,
                takenAt: patch.takenAt,
                focusX: patch.focusX,
                focusY: patch.focusY,
                zoom: patch.zoom,
                rotation: patch.rotation,
                cropX: patch.cropX,
                cropY: patch.cropY,
                cropW: patch.cropW,
                cropH: patch.cropH,
              }),
            });
            if (!res.ok) throw new Error("patch failed");
            setError(null);
          } catch {
            setError("Échec de l’enregistrement de la photo");
          }
        }, 450)
      );
    },
    [postId]
  );

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (!list.length) return;
      setBusy(true);
      setError(null);
      try {
        for (const file of list) {
          const body = new FormData();
          body.append("file", file);
          const res = await fetch(`/api/posts/${postId}/images`, {
            method: "POST",
            body,
          });
          if (!res.ok) throw new Error("upload failed");
          const created = toEditorImage(await res.json());
          setImages((prev) => [...prev, created]);
          setSelectedId(created.id);
        }
      } catch {
        setError("Échec du téléversement");
      } finally {
        setBusy(false);
      }
    },
    [postId]
  );

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length) {
        e.preventDefault();
        void uploadFiles(files);
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [uploadFiles]);

  async function reorder(fromIndex: number, toIndex: number) {
    if (toIndex < 0 || toIndex >= images.length) return;
    const next = [...images];
    const [item] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, item);
    setImages(next);
    const res = await fetch(`/api/posts/${postId}/images/reorder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageIds: next.map((i) => i.id) }),
    });
    if (!res.ok) setError("Échec du réordonnancement");
  }

  async function removeImage(id: string) {
    const res = await fetch(`/api/posts/${postId}/images/${id}`, {
      method: "DELETE",
    });
    if (!res.ok && res.status !== 204) {
      setError("Échec de la suppression");
      return;
    }
    setImages((prev) => {
      const next = prev.filter((i) => i.id !== id);
      if (selectedId === id) setSelectedId(next[0]?.id ?? null);
      return next;
    });
  }

  function updateSelected(patch: Partial<GalleryEditorImage>) {
    if (!selected) return;
    void patchImage(selected.id, patch);
  }

  return (
    <section className="space-y-4 rounded-lg border border-[#d4dde6] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-[#0D131A]">
          Photos de l’article ({images.length})
        </h2>
        {busy && <span className="text-xs text-[#495867]">Envoi…</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>

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
          if (e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files);
        }}
        className={`rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors ${
          dragOver
            ? "border-[#495867] bg-[#eef3f7]"
            : "border-[#d4dde6] bg-[#fafbfc]"
        }`}
      >
        <p className="text-sm text-[#495867]">
          Glisser-déposer, coller (Ctrl/Cmd+V) ou
        </p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className="mt-2 rounded-md border border-[#495867] px-3 py-1.5 text-sm text-[#495867] hover:bg-white disabled:opacity-50"
        >
          Choisir des images
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          capture="environment"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {images.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, index) => (
            <div key={img.id} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setSelectedId(img.id)}
                className={`block h-16 w-16 overflow-hidden rounded border-2 ${
                  selectedId === img.id
                    ? "border-[#495867]"
                    : "border-transparent"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.urlPicto || img.urlPetite || img.urlOrigin}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </button>
              <div className="mt-1 flex justify-center gap-0.5">
                <button
                  type="button"
                  className="text-[10px] text-[#495867]"
                  onClick={() => void reorder(index, index - 1)}
                  aria-label="Monter"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="text-[10px] text-[#495867]"
                  onClick={() => void reorder(index, index + 1)}
                  aria-label="Descendre"
                >
                  ↓
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="grid gap-4 lg:grid-cols-2">
          <GalleryImage image={selected} locale={lang} />

          <div className="space-y-3 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs text-[#495867]">Titre FR</span>
                <input
                  value={selected.titleFr}
                  onChange={(e) => updateSelected({ titleFr: e.target.value })}
                  className="mt-0.5 w-full rounded border border-[#d4dde6] px-2 py-1"
                />
              </label>
              <label className="block">
                <span className="text-xs text-[#495867]">Title EN</span>
                <input
                  value={selected.titleEn}
                  onChange={(e) => updateSelected({ titleEn: e.target.value })}
                  className="mt-0.5 w-full rounded border border-[#d4dde6] px-2 py-1"
                />
              </label>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs text-[#495867]">Description FR</span>
                <textarea
                  value={selected.descriptionFr}
                  onChange={(e) =>
                    updateSelected({ descriptionFr: e.target.value })
                  }
                  rows={2}
                  className="mt-0.5 w-full rounded border border-[#d4dde6] px-2 py-1"
                />
              </label>
              <label className="block">
                <span className="text-xs text-[#495867]">Description EN</span>
                <textarea
                  value={selected.descriptionEn}
                  onChange={(e) =>
                    updateSelected({ descriptionEn: e.target.value })
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
                  selected.takenAt
                    ? (typeof selected.takenAt === "string"
                        ? selected.takenAt
                        : selected.takenAt.toISOString()
                      ).slice(0, 10)
                    : ""
                }
                onChange={(e) =>
                  updateSelected({
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
                  value={selected.focusX}
                  onChange={(e) =>
                    updateSelected({ focusX: Number(e.target.value) })
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
                  value={selected.focusY}
                  onChange={(e) =>
                    updateSelected({ focusY: Number(e.target.value) })
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
                  value={selected.zoom}
                  onChange={(e) =>
                    updateSelected({ zoom: Number(e.target.value) })
                  }
                  className="flex-1"
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="w-20 text-xs">Rotation</span>
                <select
                  value={selected.rotation}
                  onChange={(e) =>
                    updateSelected({ rotation: Number(e.target.value) })
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
                    ["cropX", selected.cropX],
                    ["cropY", selected.cropY],
                    ["cropW", selected.cropW],
                    ["cropH", selected.cropH],
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
                        updateSelected({ [key]: Number(e.target.value) })
                      }
                      className="w-full rounded border border-[#d4dde6] px-1 py-0.5 text-xs"
                    />
                  </label>
                ))}
              </div>
            </fieldset>

            <button
              type="button"
              onClick={() => void removeImage(selected.id)}
              className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
            >
              Supprimer cette photo
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
