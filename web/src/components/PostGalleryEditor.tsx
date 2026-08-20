"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualUrl } from "@/hooks/useVirtualUrl";
import {
  parsePhotoModalState,
  PHOTO_MODAL_PARAM_KEYS,
  serializePhotoModalState,
} from "@/lib/virtual-url";
import {
  type GalleryEditorImage,
  coverUrlFromImage,
  findCoverImage,
  toEditorImage,
} from "@/lib/gallery-editor";
import { PhotoEditModal } from "./PhotoEditModal";
import {
  newPhotoEditorTraceId,
  photoEditorTrace,
  readApiErrorBody,
} from "@/lib/media-trace-client";

export type { GalleryEditorImage };
export { toEditorImage };

type Props = {
  postId: string;
  lang: "fr" | "en";
  initialImages: GalleryEditorImage[];
  coverImageUrl: string | null;
  onCoverChange: (url: string | null) => void;
};

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
  const [images, setImages] = useState<GalleryEditorImage[]>(() =>
    normalizeImages(initialImages)
  );
  const { searchParams, pushVirtual, closeVirtual, markOpenedViaPush } =
    useVirtualUrl();
  const modal = useMemo(
    () => parsePhotoModalState(searchParams),
    [searchParams]
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const orphanImportRef = useRef(false);

  const coverImage = findCoverImage(images, coverImageUrl);
  const editingCoverImage =
    modal.kind === "edit-cover"
      ? images.find((i) => i.id === modal.imageId) ?? null
      : null;
  const coverModalOpen =
    modal.kind === "add-cover" || modal.kind === "edit-cover";

  const upsertImage = useCallback((image: GalleryEditorImage) => {
    setImages((prev) => {
      const idx = prev.findIndex((i) => i.id === image.id);
      if (idx === -1) return [...prev, image];
      const next = [...prev];
      next[idx] = image;
      return next;
    });
  }, []);

  // Import orphan cover URLs (raw /api/media) into PostImage / médiathèque.
  useEffect(() => {
    if (orphanImportRef.current) return;
    if (!coverImageUrl) return;
    if (findCoverImage(images, coverImageUrl)) return;

    orphanImportRef.current = true;
    let cancelled = false;

    async function importOrphanCover() {
      const trace = { traceId: newPhotoEditorTraceId(), postId };
      setBusy(true);
      setError(null);
      photoEditorTrace(trace, "orphanCover.import.start", { coverImageUrl }, "info");
      try {
        const res = await fetch(`/api/posts/${postId}/images`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resolveStoredUrl: coverImageUrl }),
        });
        if (!res.ok) {
          const errBody = await readApiErrorBody(res);
          photoEditorTrace(trace, "orphanCover.import.failed", {
            status: res.status,
            ...errBody,
          }, "error");
          throw new Error("import failed");
        }
        const created = toEditorImage(await res.json());
        photoEditorTrace(trace, "orphanCover.import.done", {
          mediaId: created.id,
          urlOrigin: created.urlOrigin,
        }, "info");
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

  function openPhotoModal(
    state: Exclude<ReturnType<typeof parsePhotoModalState>, { kind: "closed" }>
  ) {
    pushVirtual(serializePhotoModalState(state), PHOTO_MODAL_PARAM_KEYS);
    markOpenedViaPush();
  }

  function closePhotoModal() {
    closeVirtual(PHOTO_MODAL_PARAM_KEYS);
  }

  function openCoverEditor() {
    if (coverImage) {
      openPhotoModal({ kind: "edit-cover", imageId: coverImage.id });
      return;
    }
    openPhotoModal({ kind: "add-cover" });
  }

  function clearCoverOnly() {
    onCoverChange(null);
  }

  function handleImageSaved(image: GalleryEditorImage) {
    upsertImage(image);
    onCoverChange(coverUrlFromImage(image));
  }

  function handleImageDeleted(id: string) {
    setImages((prev) => prev.filter((i) => i.id !== id));
    if (coverImage?.id === id) {
      onCoverChange(null);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border border-[#d4dde6] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-[#0D131A]">
          {lang === "fr" ? "Photo de couverture" : "Cover photo"}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {busy && <span className="text-xs text-[#495867]">…</span>}
          {error && <span className="text-xs text-red-600">{error}</span>}
          <button
            type="button"
            onClick={openCoverEditor}
            className="rounded-md border border-[#495867] px-3 py-1.5 text-sm text-[#495867] hover:bg-[#eef3f7]"
          >
            {coverImage || coverImageUrl
              ? lang === "fr"
                ? "Éditer la couverture"
                : "Edit cover"
              : lang === "fr"
                ? "Ajouter une couverture"
                : "Add cover"}
          </button>
          {(coverImage || coverImageUrl) && (
            <button
              type="button"
              onClick={clearCoverOnly}
              className="rounded-md border border-[#d4dde6] px-3 py-1.5 text-sm text-[#495867] hover:bg-[#eef3f7]"
            >
              {lang === "fr" ? "Retirer" : "Remove"}
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-[#495867]">
        {lang === "fr"
          ? "Photo optionnelle affichée en en-tête de l’article. Les autres médias s’ajoutent via des groupes dans le corps du texte."
          : "Optional photo shown at the top of the article. Other media belong in inline groups within the body."}
      </p>
      {coverImage || coverImageUrl ? (
        <button
          type="button"
          onClick={openCoverEditor}
          className="block w-full overflow-hidden rounded-md border border-[#d4dde6]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={
              coverImage
                ? coverUrlFromImage(coverImage)
                : coverImageUrl!
            }
            src={
              coverImage
                ? coverUrlFromImage(coverImage)
                : coverImageUrl!
            }
            alt=""
            className="aspect-[16/10] w-full object-cover sm:aspect-[2/1]"
          />
        </button>
      ) : (
        <p className="rounded-lg border border-dashed border-[#d4dde6] bg-[#fafbfc] px-4 py-6 text-center text-sm text-[#495867]">
          {lang === "fr"
            ? "Aucune couverture — ajoute une photo ou laisse vide."
            : "No cover — add a photo or leave empty."}
        </p>
      )}

      {coverModalOpen && (
        <PhotoEditModal
          key={
            modal.kind === "edit-cover"
              ? `edit-cover-${modal.imageId}`
              : "add-cover"
          }
          postId={postId}
          lang={lang}
          mode={modal.kind === "add-cover" ? "add" : "edit"}
          imagesOnly
          image={modal.kind === "edit-cover" ? editingCoverImage : null}
          onClose={closePhotoModal}
          onSaved={handleImageSaved}
          onDeleted={handleImageDeleted}
        />
      )}
    </section>
  );
}
