export type GalleryPhoto = {
  id: string;
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

export type GalleryFilters = {
  hull?: string;
  theme?: string;
  tag?: string;
  milestone?: string;
  search?: string;
  sort?: "date" | "milestone";
};
