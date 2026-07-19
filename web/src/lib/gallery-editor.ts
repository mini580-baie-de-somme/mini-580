export type GalleryEditorImage = {
  id: string;
  kind?: "IMAGE" | "DOCUMENT" | "VIDEO" | string;
  mimeType?: string | null;
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

/** Prefer a sized variant for cards / header display. */
export function coverUrlFromImage(image: GalleryEditorImage): string {
  return (
    image.urlMoyenne ||
    image.urlGrande ||
    image.urlPetite ||
    image.urlOrigin
  );
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
