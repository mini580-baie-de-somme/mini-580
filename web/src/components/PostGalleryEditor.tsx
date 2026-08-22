"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualUrl } from "@/hooks/useVirtualUrl";
import {
  parsePhotoModalState,
  PHOTO_MODAL_PARAM_KEYS,
  serializePhotoModalState,
} from "@/lib/virtual-url";
import {
  COVER_DEFAULT_CROP_FORMAT,
  shouldNormalizeCoverFormat,
} from "@/lib/cover-display";
import {
  type GalleryEditorImage,
  coverUrlFromImage,
  mergeEditorImageLayout,
  mediaVariantSnapshot,
  resolveCoverImage,
  toEditorImage,
} from "@/lib/gallery-editor";
import { DEFAULT_IMAGE_LAYOUT } from "@/lib/image-layout";
import { followUpPostRebakePoll } from "@/lib/save-media-flow";
import { CoverImageDisplay } from "./CoverImageDisplay";
import { FullscreenEditorModal } from "./FullscreenEditorModal";
import { MediaKindThumb } from "./MediaKindThumb";
import { PhotoEditModal } from "./PhotoEditModal";
import { t } from "@/lib/i18n";
import {
  newPhotoEditorTraceId,
  photoEditorTrace,
  readApiErrorBody,
} from "@/lib/media-trace-client";

type LibraryPickerItem = {
  id: string;
  kind: string;
  mimeType?: string;
  titleFr: string;
  titleEn: string;
  urlOrigin: string;
  urlPicto: string | null;
  urlMoyenne: string | null;
};

function libraryThumbSrc(item: LibraryPickerItem): string | null {
  if (item.kind === "IMAGE") {
    return item.urlPicto || item.urlMoyenne || item.urlOrigin;
  }
  return item.urlPicto || item.urlMoyenne || null;
}

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
  const [libraryItems, setLibraryItems] = useState<LibraryPickerItem[]>([]);
  const [libraryQ, setLibraryQ] = useState("");
  const [libraryLoading, setLibraryLoading] = useState(false);
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

  function openLibraryPicker() {
    setLibraryQ("");
    openPhotoModal({ kind: "pick-library" });
  }

  useEffect(() => {
    if (modal.kind !== "pick-library") return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        setLibraryLoading(true);
        setError(null);
        try {
          const params = new URLSearchParams();
          params.set("kind", "IMAGE");
          params.set("limit", "50");
          params.set("offset", "0");
          if (libraryQ.trim()) params.set("q", libraryQ.trim());
          const res = await fetch(`/api/media-library?${params.toString()}`);
          if (!res.ok) throw new Error("library failed");
          const data = (await res.json()) as { items: LibraryPickerItem[] };
          if (!cancelled) setLibraryItems(data.items ?? []);
        } catch {
          if (!cancelled) {
            setLibraryItems([]);
            setError(
              lang === "fr"
                ? "Impossible de charger la médiathèque"
                : "Could not load media library"
            );
          }
        } finally {
          if (!cancelled) setLibraryLoading(false);
        }
      })();
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [modal.kind, libraryQ, lang]);

  async function attachCoverFromLibrary(mediaId: string) {
    if (coverMediaIdRef.current === mediaId && coverMediaIdRef.current) {
      closePhotoModal();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/posts/${postId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaIds: [mediaId], setCoverFirst: true }),
      });
      if (!res.ok) throw new Error("attach failed");
      const linked = (await res.json()) as Record<string, unknown>[];
      let image = toEditorImage(linked[0]);

      // Default library cover to 16:9 only on first attach — never override later edits.
      const isFirstCoverAttach =
        !coverImageUrl && !coverMediaIdRef.current && !coverImage;
      if (
        shouldNormalizeCoverFormat(image.cropAspectFormat, {
          isFirstCoverAttach,
        })
      ) {
        const layout = { ...DEFAULT_IMAGE_LAYOUT };
        const trace = {
          traceId: newPhotoEditorTraceId(),
          postId,
          mediaId: image.id,
        };
        const patchRes = await fetch(`/api/posts/${postId}/images/${image.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...layout,
            cropAspectFormat: COVER_DEFAULT_CROP_FORMAT,
          }),
        });
        if (!patchRes.ok) throw new Error("cover format patch failed");
        const patched = toEditorImage(await patchRes.json()) as GalleryEditorImage & {
          rebakePending?: boolean;
        };
        image = mergeEditorImageLayout(patched, layout);
        if (patched.rebakePending) {
          followUpPostRebakePoll({
            mediaId: image.id,
            layout,
            isImage: true,
            patchVariantBaseline: mediaVariantSnapshot(patched),
            trace,
            onSaved: handleImageSaved,
            cropAspectFormat: COVER_DEFAULT_CROP_FORMAT,
          });
        }
      }

      handleImageSaved(image);
      closePhotoModal();
    } catch {
      setError(
        lang === "fr" ? "Association impossible" : "Could not attach cover"
      );
    } finally {
      setBusy(false);
    }
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
            onClick={openLibraryPicker}
            className="rounded-md border border-[#d4dde6] px-3 py-1.5 text-sm text-[#495867] hover:bg-[#eef3f7]"
          >
            {t("media.pickFromLibrary", lang)}
          </button>
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
            ? "Aucune couverture — choisis une photo dans la médiathèque, uploade-en une, ou laisse vide."
            : "No cover — pick from the library, upload a photo, or leave empty."}
        </p>
      )}

      {modal.kind === "pick-library" && (
        <FullscreenEditorModal
          title={
            lang === "fr"
              ? "Choisir une couverture"
              : "Pick a cover photo"
          }
          onClose={closePhotoModal}
          busy={busy || libraryLoading}
          footerRight={
            <button
              type="button"
              onClick={closePhotoModal}
              className="rounded-md border border-[#d4dde6] px-3 py-2 text-sm"
            >
              {lang === "fr" ? "Annuler" : "Cancel"}
            </button>
          }
        >
          <div className="h-full overflow-y-auto p-4">
            <input
              type="search"
              value={libraryQ}
              onChange={(e) => setLibraryQ(e.target.value)}
              placeholder={
                lang === "fr" ? "Rechercher dans la médiathèque…" : "Search library…"
              }
              className="mb-3 w-full rounded border border-[#d4dde6] px-3 py-2 text-sm"
            />
            {libraryLoading ? (
              <p className="text-sm text-[#495867]">…</p>
            ) : libraryItems.length === 0 ? (
              <p className="text-sm text-[#495867]">
                {lang === "fr"
                  ? "Aucune photo disponible dans la médiathèque."
                  : "No photos available in the library."}
              </p>
            ) : (
              <ul className="mx-auto grid max-w-3xl gap-2 sm:grid-cols-2">
                {libraryItems.map((item) => {
                  const isCurrentCover = coverMediaIdRef.current === item.id;
                  const label =
                    (lang === "fr" ? item.titleFr : item.titleEn) ||
                    item.id.slice(0, 8);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        disabled={busy || isCurrentCover}
                        onClick={() => void attachCoverFromLibrary(item.id)}
                        className="flex w-full items-center gap-3 rounded border border-[#d4dde6] px-3 py-2 text-left hover:bg-[#f8fafc] disabled:cursor-default disabled:opacity-50"
                      >
                        <MediaKindThumb
                          kind={item.kind}
                          mimeType={item.mimeType}
                          src={libraryThumbSrc(item)}
                        />
                        <span className="min-w-0 text-sm">
                          <span className="block truncate font-medium">{label}</span>
                          {isCurrentCover && (
                            <span className="text-xs text-[#495867]">
                              {lang === "fr" ? "Couverture actuelle" : "Current cover"}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </FullscreenEditorModal>
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
