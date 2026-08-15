import type { ImageLayoutParams } from "@/lib/image-layout";

export type GalleryEditorImage = {
  id: string;
  kind?: "IMAGE" | "DOCUMENT" | "VIDEO" | string;
  mimeType?: string | null;
  updatedAt?: string | null;
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
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  lockAspect: boolean;
  cropShape: "RECT" | "CIRCLE" | string;
  backgroundColor: string;
  cropInset: number;
  focusX: number;
  focusY: number;
  zoom: number;
  rotation: number;
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
};

export function toEditorImage(raw: Record<string, unknown>): GalleryEditorImage {
  return {
    id: String(raw.id),
    kind: raw.kind ? String(raw.kind) : "IMAGE",
    mimeType: raw.mimeType != null ? String(raw.mimeType) : null,
    updatedAt: raw.updatedAt
      ? new Date(String(raw.updatedAt)).toISOString()
      : null,
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
    offsetX: Number(raw.offsetX ?? 0),
    offsetY: Number(raw.offsetY ?? 0),
    scaleX: Number(raw.scaleX ?? raw.zoom ?? 1),
    scaleY: Number(raw.scaleY ?? raw.zoom ?? 1),
    lockAspect: raw.lockAspect == null ? true : Boolean(raw.lockAspect),
    cropShape: raw.cropShape === "CIRCLE" ? "CIRCLE" : "RECT",
    backgroundColor: String(raw.backgroundColor ?? "#000000"),
    cropInset: Number(raw.cropInset ?? 0.06),
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

/**
 * Canvas source for layout editing — always the full origin (or local pending file).
 * Never use baked variants: they are already cropped and low-res, which breaks WYSIWYG
 * and makes move/rotate/crop feel like working on a degraded image.
 */
function withCacheBust(url: string, bust?: string | null): string {
  if (!bust) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${encodeURIComponent(bust)}`;
}

/** Cache-bust param for thumbs after layout/variant changes. */
export function galleryThumbCacheBust(
  image: Pick<
    GalleryEditorImage,
    "scaleX" | "rotation" | "offsetX" | "offsetY" | "urlPicto" | "urlPetite" | "updatedAt"
  >,
  displayUrl?: string | null
): string {
  const path = (displayUrl || image.urlPicto || image.urlPetite || "")
    .split("?")[0]!;
  const stamp = image.updatedAt ? new Date(image.updatedAt).getTime() : 0;
  const leaf = path.split("/").pop();
  return `${stamp}-${image.scaleX.toFixed(4)}-${image.rotation.toFixed(2)}-${leaf || "none"}`;
}

export function editorCanvasSrc(
  image: Pick<GalleryEditorImage, "urlOrigin" | "updatedAt"> | null | undefined,
  localPreviewUrl?: string | null
): string | null {
  if (localPreviewUrl) return localPreviewUrl;
  const origin = image?.urlOrigin?.trim();
  if (!origin) return null;
  return withCacheBust(origin, image?.updatedAt ?? null);
}

/** Small square thumb in post editor gallery strip (baked variant, never origin). */
export function galleryThumbSrc(image: GalleryEditorImage): string | null {
  let base: string | null;
  if ((image.kind || "IMAGE") !== "IMAGE") {
    base = image.urlPicto || image.urlPetite || null;
  } else {
    base = image.urlPicto || image.urlPetite || image.urlMoyenne || null;
  }
  if (!base) return null;
  return withCacheBust(base, galleryThumbCacheBust(image, base));
}

export type MediaVariantSnapshot = {
  urlPicto?: string | null;
  urlPetite?: string | null;
  urlMoyenne?: string | null;
  urlGrande?: string | null;
};

export function mediaVariantSnapshot(
  image: Pick<
    GalleryEditorImage,
    "urlPicto" | "urlPetite" | "urlMoyenne" | "urlGrande"
  > | null | undefined
): MediaVariantSnapshot {
  return {
    urlPicto: image?.urlPicto ?? null,
    urlPetite: image?.urlPetite ?? null,
    urlMoyenne: image?.urlMoyenne ?? null,
    urlGrande: image?.urlGrande ?? null,
  };
}

/** Merge persisted layout fields onto an API image row (post-save / rebake poll). */
export function mergeEditorImageLayout(
  image: GalleryEditorImage,
  layout: ImageLayoutParams
): GalleryEditorImage {
  return {
    ...image,
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
  };
}

/** Prefer a sized variant for cards / header display. */
export function coverUrlFromImage(image: GalleryEditorImage): string {
  return (
    image.urlMoyenne ||
    image.urlGrande ||
    image.urlPetite ||
    image.urlOrigin
  );
}

/** Open in new tab: largest baked variant for images (crop applied), origin for docs/video. */
export function mediaLibraryOpenUrl(
  media: Pick<
    GalleryEditorImage,
    "kind" | "urlOrigin" | "urlGrande" | "urlMoyenne" | "urlPetite"
  >
): string {
  if ((media.kind || "IMAGE") === "IMAGE") {
    return (
      media.urlGrande ||
      media.urlMoyenne ||
      media.urlPetite ||
      media.urlOrigin
    );
  }
  return media.urlOrigin;
}

export function findCoverImage(
  images: GalleryEditorImage[],
  coverImageUrl: string | null | undefined
): GalleryEditorImage | null {
  if (!coverImageUrl) return null;
  return (
    images.find(
      (img) =>
        img.urlOrigin === coverImageUrl ||
        img.urlMoyenne === coverImageUrl ||
        img.urlGrande === coverImageUrl ||
        img.urlPetite === coverImageUrl ||
        img.urlPicto === coverImageUrl
    ) ?? null
  );
}
