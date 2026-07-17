"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type GalleryEditorImage,
  coverUrlFromImage,
  findCoverImage,
  toEditorImage,
} from "@/lib/gallery-editor";
import { PhotoEditModal } from "./PhotoEditModal";

export type { GalleryEditorImage };
export { toEditorImage };

type Props = {
  postId: string;
  lang: "fr" | "en";
  initialImages: GalleryEditorImage[];
  coverImageUrl: string | null;
  onCoverChange: (url: string | null) => void;
};

type ModalState =
  | { kind: "closed" }
  | { kind: "add" }
  | { kind: "edit"; imageId: string }
  | { kind: "add-cover" }
  | { kind: "edit-cover"; imageId: string }
  | { kind: "pick-library" };

function normalizeImages(list: GalleryEditorImage[]): GalleryEditorImage[] {
  return list.map((img) => ({
    ...img,
    takenAt: img.takenAt
      ? typeof img.takenAt === "string"
        ? img.takenAt
        : new Date(img.takenAt).toISOString()
      : null,
  }));
}

export function PostGalleryEditor({
  postId,
  lang,
  initialImages,
  coverImageUrl,
  onCoverChange,
}: Props) {
  // Local list is source of truth while editing — do not reset from parent
  // re-renders (autosave / router.refresh), which was wiping reorder.
  const [images, setImages] = useState<GalleryEditorImage[]>(() =>
    normalizeImages(initialImages)
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    initialImages[0]?.id ?? null
  );
  const [modal, setModal] = useState<ModalState>({ kind: "closed" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [libraryItems, setLibraryItems] = useState<
    { id: string; kind: string; titleFr: string; titleEn: string; urlOrigin: string; urlPicto: string | null; urlMoyenne: string | null }[]
  >([]);
  const [librarySelected, setLibrarySelected] = useState<Set<string>>(new Set());
  const orphanImportRef = useRef(false);

  const selected = images.find((i) => i.id === selectedId) ?? null;
  const coverImage = findCoverImage(images, coverImageUrl);
  const editingImage =
    modal.kind === "edit" || modal.kind === "edit-cover"
      ? images.find((i) => i.id === modal.imageId) ?? null
      : null;
  const isCoverModal =
    modal.kind === "add-cover" || modal.kind === "edit-cover";

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

  // Import orphan cover URLs (raw /api/media) into PostImage / médiathèque.
  useEffect(() => {
    if (orphanImportRef.current) return;
    if (!coverImageUrl) return;
    if (findCoverImage(images, coverImageUrl)) return;

    orphanImportRef.current = true;
    let cancelled = false;

    async function importOrphanCover() {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/posts/${postId}/images`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urlOrigin: coverImageUrl }),
        });
        if (!res.ok) throw new Error("import failed");
        const created = toEditorImage(await res.json());
        if (cancelled) return;
        upsertImage(created);
        onCoverChange(coverUrlFromImage(created));
      } catch {
        if (!cancelled) {
          setError("Impossible d’importer la couverture dans la médiathèque");
          orphanImportRef.current = false;
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }

    void importOrphanCover();
    return () => {
      cancelled = true;
    };
    // Intentional: run once for the initial orphan cover, not on every images change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coverImageUrl, postId]);

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

  function openCoverEditor() {
    if (coverImage) {
      setModal({ kind: "edit-cover", imageId: coverImage.id });
      return;
    }
    setModal({ kind: "add-cover" });
  }

  function clearCoverOnly() {
    onCoverChange(null);
  }

  function useSelectedAsCover() {
    if (!selected) return;
    onCoverChange(coverUrlFromImage(selected));
  }

  function handleImageSaved(image: GalleryEditorImage) {
    upsertImage(image);
    if (isCoverModal) {
      onCoverChange(coverUrlFromImage(image));
    } else if (coverImage?.id === image.id) {
      // Replace/edit of the current cover photo — keep URL in sync.
      onCoverChange(coverUrlFromImage(image));
    }
  }

  async function openLibraryPicker() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/media-library?limit=50&offset=0");
      if (!res.ok) throw new Error("library failed");
      const data = (await res.json()) as {
        items: {
          id: string;
          kind: string;
          titleFr: string;
          titleEn: string;
          urlOrigin: string;
          urlPicto: string | null;
          urlMoyenne: string | null;
        }[];
      };
      const already = new Set(images.map((i) => i.id));
      setLibraryItems(data.items.filter((i) => !already.has(i.id)));
      setLibrarySelected(new Set());
      setModal({ kind: "pick-library" });
    } catch {
      setError("Impossible de charger la médiathèque");
    } finally {
      setBusy(false);
    }
  }

  async function attachFromLibrary() {
    if (librarySelected.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      const mediaIds = [...librarySelected];
      const res = await fetch(`/api/posts/${postId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaIds }),
      });
      if (!res.ok) throw new Error("attach failed");
      const linked = (await res.json()) as Record<string, unknown>[];
      for (const raw of linked) {
        upsertImage(toEditorImage(raw));
      }
      setModal({ kind: "closed" });
    } catch {
      setError("Association impossible");
    } finally {
      setBusy(false);
    }
  }

  function handleImageDeleted(id: string) {
    setImages((prev) => {
      const next = prev.filter((i) => i.id !== id);
      setSelectedId((cur) => (cur === id ? (next[0]?.id ?? null) : cur));
      return next;
    });
    if (coverImage?.id === id) {
      onCoverChange(null);
    }
  }

  return (
    <section className="space-y-6">
      <div className="space-y-3 rounded-lg border border-[#d4dde6] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-[#0D131A]">
            Image de couverture
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openCoverEditor}
              className="rounded-md border border-[#495867] px-3 py-1.5 text-sm text-[#495867] hover:bg-[#eef3f7]"
            >
              {coverImage || coverImageUrl
                ? "Éditer la couverture"
                : "Ajouter une couverture"}
            </button>
            {(coverImage || coverImageUrl) && (
              <button
                type="button"
                onClick={clearCoverOnly}
                className="rounded-md border border-[#d4dde6] px-3 py-1.5 text-sm text-[#495867] hover:bg-[#eef3f7]"
              >
                Retirer
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-[#495867]">
          Enregistrée dans la médiathèque comme les autres photos — crop, meta,
          variantes et galerie publique.
        </p>
        {coverImage || coverImageUrl ? (
          <button
            type="button"
            onClick={openCoverEditor}
            className="block overflow-hidden rounded-md border border-[#d4dde6]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={
                coverImage
                  ? coverImage.urlPicto ||
                    coverImage.urlPetite ||
                    coverUrlFromImage(coverImage)
                  : coverImageUrl!
              }
              alt=""
              className="max-h-48 w-auto object-cover"
            />
          </button>
        ) : (
          <p className="rounded-lg border border-dashed border-[#d4dde6] bg-[#fafbfc] px-4 py-6 text-center text-sm text-[#495867]">
            Aucune couverture — ajoute une image ou choisis une photo de
            l’article ci-dessous.
          </p>
        )}
        {selected && coverImage?.id !== selected.id && (
          <button
            type="button"
            onClick={useSelectedAsCover}
            className="rounded-md bg-[#eef3f7] px-3 py-1.5 text-sm text-[#495867] hover:bg-[#e0e8ef]"
          >
            Utiliser la photo sélectionnée comme couverture
          </button>
        )}
      </div>

      <div className="space-y-4 rounded-lg border border-[#d4dde6] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-[#0D131A]">
            Médias de l’article ({images.length})
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {busy && <span className="text-xs text-[#495867]">…</span>}
            {error && <span className="text-xs text-red-600">{error}</span>}
            <button
              type="button"
              onClick={() => void openLibraryPicker()}
              className="rounded-md border border-[#d4dde6] px-3 py-1.5 text-sm text-[#495867] hover:bg-[#eef3f7]"
            >
              Depuis la médiathèque
            </button>
            <button
              type="button"
              onClick={() => setModal({ kind: "add" })}
              className="rounded-md border border-[#495867] px-3 py-1.5 text-sm text-[#495867] hover:bg-[#eef3f7]"
            >
              Ajouter fichier
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
              Éditer
            </button>
          </div>
        </div>

        {images.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[#d4dde6] bg-[#fafbfc] px-4 py-8 text-center text-sm text-[#495867]">
            Aucun média — uploade un fichier ou choisis depuis la médiathèque.
          </p>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {images.map((img, index) => {
              const isCover = coverImage?.id === img.id;
              return (
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
                  {isCover && (
                    <span className="absolute -top-1 left-0 rounded bg-[#495867] px-1 text-[9px] font-medium text-white">
                      Cover
                    </span>
                  )}
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
              );
            })}
          </div>
        )}
      </div>

      {modal.kind === "pick-library" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-lg bg-white p-4 shadow-lg">
            <h3 className="mb-3 text-lg font-semibold text-[#0D131A]">
              Médias de la bibliothèque
            </h3>
            {libraryItems.length === 0 ? (
              <p className="text-sm text-[#495867]">Aucun média disponible à associer.</p>
            ) : (
              <ul className="mb-4 space-y-2">
                {libraryItems.map((item) => {
                  const checked = librarySelected.has(item.id);
                  return (
                    <li key={item.id}>
                      <label className="flex cursor-pointer items-center gap-3 rounded border border-[#d4dde6] px-3 py-2 hover:bg-[#f8fafc]">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setLibrarySelected((prev) => {
                              const next = new Set(prev);
                              if (next.has(item.id)) next.delete(item.id);
                              else next.add(item.id);
                              return next;
                            });
                          }}
                        />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {item.kind === "IMAGE" ? (
                          <img
                            src={item.urlPicto || item.urlMoyenne || item.urlOrigin}
                            alt=""
                            className="h-10 w-10 rounded object-cover"
                          />
                        ) : (
                          <span className="flex h-10 w-10 items-center justify-center rounded bg-[#eef3f7] text-[10px] font-semibold">
                            {item.kind === "DOCUMENT" ? "PDF" : "VID"}
                          </span>
                        )}
                        <span className="text-sm">
                          {item.titleFr || item.titleEn || item.id.slice(0, 8)}
                          <span className="ml-2 text-xs text-[#495867]">{item.kind}</span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy || librarySelected.size === 0}
                onClick={() => void attachFromLibrary()}
                className="rounded-md bg-[#495867] px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                Associer ({librarySelected.size})
              </button>
              <button
                type="button"
                onClick={() => setModal({ kind: "closed" })}
                className="rounded-md border border-[#d4dde6] px-3 py-2 text-sm"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {modal.kind !== "closed" && modal.kind !== "pick-library" && (
        <PhotoEditModal
          postId={postId}
          lang={lang}
          mode={
            modal.kind === "add" || modal.kind === "add-cover" ? "add" : "edit"
          }
          image={
            modal.kind === "edit" || modal.kind === "edit-cover"
              ? editingImage
              : null
          }
          onClose={() => setModal({ kind: "closed" })}
          onSaved={handleImageSaved}
          onDeleted={handleImageDeleted}
        />
      )}
    </section>
  );
}
