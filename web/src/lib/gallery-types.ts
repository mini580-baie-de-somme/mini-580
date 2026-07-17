export type MediaKindFilter = "IMAGE" | "DOCUMENT" | "VIDEO" | "ALL";

export type GalleryItem = {
  id: string;
  kind: "IMAGE" | "DOCUMENT" | "VIDEO";
  mimeType: string;
  titleFr: string;
  titleEn: string;
  descriptionFr: string;
  descriptionEn: string;
  takenAt: string | null;
  sortOrder: number;
  urlOrigin: string;
  urlPicto: string | null;
  urlPetite: string | null;
  urlMoyenne: string | null;
  urlGrande: string | null;
  thumbUrl: string;
  displayUrl: string;
  focusX: number;
  focusY: number;
  zoom: number;
  rotation: number;
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
  post: {
    id: string;
    slug: string;
    titleFr: string;
    titleEn: string;
    publishedAt: string | null;
  };
  posts: {
    id: string;
    slug: string;
    titleFr: string;
    titleEn: string;
  }[];
  milestones: {
    slug: string;
    titleFr: string;
    titleEn: string;
    milestoneDate: string;
  }[];
  themes: { slug: string; labelFr: string; labelEn: string }[];
  tags: { name: string; labelFr: string; labelEn: string }[];
  hulls: string[];
};

/** @deprecated use GalleryItem */
export type GalleryPhoto = GalleryItem;

export type GalleryFilters = {
  hull?: string;
  theme?: string;
  tag?: string;
  milestone?: string;
  search?: string;
  kind?: MediaKindFilter;
  sort?: "date" | "milestone";
};
