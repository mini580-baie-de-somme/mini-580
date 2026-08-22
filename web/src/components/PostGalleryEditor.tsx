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
  resolveCoverImage,
  toEditorImage,
} from "@/lib/gallery-editor";
import { CoverImageDisplay } from "./CoverImageDisplay";
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

function initialCoverMediaId(
  images: GalleryEditorImage[],
  coverImageUrl: string | null
): string | null {
  const flagged = images.find(
    (img) => (img as GalleryEditorImage & { isCover?: boolean }).isCover
  );
  if (flagged) return flagged.id;
  return resolveCoverImage(images, coverImageUrl)?.id ?? null;
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
  const coverMediaIdRef = useRef<string | null>(
    initialCoverMediaId(normalizeImages(initialImages), coverImageUrl)
  );

  const coverImage = resolveCoverImage(
    images,
    coverImageUrl,
    coverMediaIdRef.current
  );
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
    if (resolveCoverImage(images, coverImageUrl, coverMediaIdRef.current)) {
      return;
    }

    orphanImportRef.current = true;
    let cancelled = false;

    async function reloadImages(): Promise<GalleryEditorImage[]> {
      const listRes = await fetch(`/api/posts/${postId}/images`);
      if (!listRes.ok) return [];
      const list = (await listRes.json()) as Record<string, unknown>[];
      return list.map((row) => toEditorImage(row));
    }

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

          const reloaded = await reloadImages();
          if (!cancelled && reloaded.length > 0) {
            setImages(normalizeImages(reloaded));
            const retry = resolveCoverImage(
              reloaded,
              coverImageUrl,
              coverMediaIdRef.current
            );
            if (retry) {
              coverMediaIdRef.current = retry.id;
              onCoverChange(coverUrlFromImage(retry));
              photoEditorTrace(trace, "orphanCover.reload.resolved", {
                mediaId: retry.id,
              }, "info");
              return;
            }
          }
          throw new Error("import failed");
        }
        const created = toEditorImage(await res.json());
        photoEditorTrace(trace, "orphanCover.import.done", {
          mediaId: created.id,
          urlOrigin: created.urlOrigin,
        }, "info");
        if (cancelled) return;
        coverMediaIdRef.current = created.id;
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
    const resolved = resolveCoverImage(
      images,
      coverImageUrl,
      coverMediaIdRef.current
    );
    const mediaId = resolved?.id ?? coverMediaIdRef.current;
    if (mediaId) {
      openPhotoModal({ kind: "edit-cover", imageId: mediaId });
      return;
    }
    openPhotoModal({ kind: "add-cover" });
  }

  async function clearCoverOnly() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverImageUrl: null }),
      });
      if (!res.ok) throw new Error("clear cover failed");
      coverMediaIdRef.current = null;
      onCoverChange(null);
    } catch {
      setError(
        lang === "fr"
          ? "Impossible de retirer la couverture"
          : "Could not remove cover"
      );
    } finally {
      setBusy(false);
    }
  }

  function handleImageSaved(image: GalleryEditorImage) {
    upsertImage(image);
    coverMediaIdRef.current = image.id;
    setError(null);
    onCoverChange(coverUrlFromImage(image));
  }

  function handleImageDeleted(id: string) {
    setImages((prev) => prev.filter((i) => i.id !== id));
    if (coverImage?.id === id || coverMediaIdRef.current === id) {
      coverMediaIdRef.current = null;
      onCoverChange(null);
    }
  }

  const coverPreviewUrl = coverImage
    ? coverUrlFromImage(coverImage)
    : coverImageUrl;
  const hasCover = Boolean(coverImage || coverImageUrl || coverMediaIdRef.current);

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
            {hasCover
              ? lang === "fr"
                ? "Éditer la couverture"
                : "Edit cover"
              : lang === "fr"
                ? "Ajouter une couverture"
                : "Add cover"}
          </button>
          {hasCover && (
            <button
              type="button"
              onClick={() => void clearCoverOnly()}
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
      {coverPreviewUrl ? (
        <CoverImageDisplay
          src={coverPreviewUrl}
          cropAspectFormat={coverImage?.cropAspectFormat}
          cropShape={coverImage?.cropShape}
          wrapperClassName="rounded-md border border-[#d4dde6]"
          onClick={openCoverEditor}
        />
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
