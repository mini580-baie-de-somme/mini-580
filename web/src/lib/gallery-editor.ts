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

export function toEditorImage(raw: Record<string, unknown>): GalleryEditorImage {
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
