"use client";

import { useCallback, useState } from "react";
import {
  type GalleryEditorImage,
  toEditorImage,
} from "@/lib/gallery-editor";
import { PhotoEditModal } from "./PhotoEditModal";

export type { GalleryEditorImage };
export { toEditorImage };

type Props = {
  postId: string;
  lang: "fr" | "en";
  initialImages: GalleryEditorImage[];
};

type ModalState =
  | { kind: "closed" }
  | { kind: "add" }
  | { kind: "edit"; imageId: string };

export function PostGalleryEditor({ postId, lang, initialImages }: Props) {
  // Local list is source of truth while editing — do not reset from parent
  // re-renders (autosave / router.refresh), which was wiping reorder.
  const [images, setImages] = useState<GalleryEditorImage[]>(() =>
    initialImages.map((img) => ({
      ...img,
      takenAt: img.takenAt
        ? typeof img.takenAt === "string"
          ? img.takenAt
          : new Date(img.takenAt).toISOString()
        : null,
    }))
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    initialImages[0]?.id ?? null
  );
  const [modal, setModal] = useState<ModalState>({ kind: "closed" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = images.find((i) => i.id === selectedId) ?? null;
  const editingImage =
    modal.kind === "edit"
      ? images.find((i) => i.id === modal.imageId) ?? null
      : null;

  const upsertImage = useCallback((image: GalleryEditorImage) => {
    setImages((prev) => {
      const idx = prev.findIndex((i) => i.id === image.id);
      if (idx === -1) return [...prev, image];
      const next = [...prev];
      next[idx] = image;
      return next;
    });
    setSelectedId(image.id);
  }, []);

  async function reorder(fromIndex: number, toIndex: number) {
    if (toIndex < 0 || toIndex >= images.length) return;
    const next = [...images];
    const [item] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, item);
    setImages(next);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/posts/${postId}/images/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageIds: next.map((i) => i.id) }),
      });
      if (!res.ok) throw new Error("reorder failed");
    } catch {
      setError("Échec du réordonnancement");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-lg border border-[#d4dde6] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-[#0D131A]">
          Photos de l’article ({images.length})
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {busy && <span className="text-xs text-[#495867]">…</span>}
          {error && <span className="text-xs text-red-600">{error}</span>}
          <button
            type="button"
            onClick={() => setModal({ kind: "add" })}
            className="rounded-md border border-[#495867] px-3 py-1.5 text-sm text-[#495867] hover:bg-[#eef3f7]"
          >
            Ajouter photo
          </button>
          <button
            type="button"
            onClick={() => {
              if (!selected) return;
              setModal({ kind: "edit", imageId: selected.id });
            }}
            disabled={!selected}
            className="rounded-md bg-[#495867] px-3 py-1.5 text-sm text-white hover:bg-[#3a4654] disabled:opacity-50"
          >
            Éditer photo
          </button>
        </div>
      </div>

      {images.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[#d4dde6] bg-[#fafbfc] px-4 py-8 text-center text-sm text-[#495867]">
          Aucune photo — utilise « Ajouter photo » pour en enregistrer une dans
          la médiathèque et la lier à cet article.
        </p>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, index) => (
            <div key={img.id} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setSelectedId(img.id)}
                onDoubleClick={() =>
                  setModal({ kind: "edit", imageId: img.id })
                }
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
                  className="text-[10px] text-[#495867] disabled:opacity-30"
                  disabled={index === 0 || busy}
                  onClick={() => void reorder(index, index - 1)}
                  aria-label="Monter"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="text-[10px] text-[#495867] disabled:opacity-30"
                  disabled={index === images.length - 1 || busy}
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

      {modal.kind !== "closed" && (
        <PhotoEditModal
          postId={postId}
          lang={lang}
          mode={modal.kind === "add" ? "add" : "edit"}
          image={modal.kind === "edit" ? editingImage : null}
          onClose={() => setModal({ kind: "closed" })}
          onSaved={upsertImage}
          onDeleted={(id) => {
            setImages((prev) => {
              const next = prev.filter((i) => i.id !== id);
              setSelectedId((cur) =>
                cur === id ? (next[0]?.id ?? null) : cur
              );
              return next;
            });
          }}
        />
      )}
    </section>
  );
}
