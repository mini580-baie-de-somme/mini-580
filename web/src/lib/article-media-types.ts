/** Client-safe media shape used by article manifest, slideshow, and inline groups. */
export type ArticleManifestMedia = {
  id: string;
  postId?: string;
  kind?: string | null;
  mimeType?: string | null;
  urlOrigin?: string;
  url?: string;
  urlPicto?: string | null;
  urlPetite?: string | null;
  urlMoyenne?: string | null;
  urlGrande?: string | null;
  titleFr?: string;
  titleEn?: string;
  descriptionFr?: string;
  descriptionEn?: string;
  captionFr?: string;
  captionEn?: string;
  focusX?: number;
  focusY?: number;
  zoom?: number;
  rotation?: number;
  cropX?: number;
  cropY?: number;
  cropW?: number;
  cropH?: number;
};

export type PublicMediaGroup = {
  id: string;
  titleFr: string;
  titleEn: string;
  layout: string;
  members: ArticleManifestMedia[];
};

export type PublicExternalLink = {
  id: string;
  labelFr: string;
  labelEn: string;
  url: string | null;
  urlFr: string | null;
  urlEn: string | null;
};

export type ArticleMediaPageData = {
  manifestFr: ArticleManifestMedia[];
  manifestEn: ArticleManifestMedia[];
  manifestIndexByGroupIdFr: Record<string, number>;
  manifestIndexByGroupIdEn: Record<string, number>;
  mediaGroups: Record<string, PublicMediaGroup>;
  externalLinks: Record<string, PublicExternalLink>;
  /** Crop format of the cover/header image (from cover PostMedia). */
  coverCropAspectFormat: string;
};
