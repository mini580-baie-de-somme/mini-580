/** Cover/header display — client + server safe (no Node imports). */

import {
  imageAspectForFormat,
  resolveCropAspectFormat,
  type CropAspectFormat,
} from "@/lib/image-layout";

export type CoverMediaRef = {
  isCover: boolean;
  media: {
    urlOrigin: string;
    urlGrande?: string | null;
    urlMoyenne?: string | null;
    urlPetite?: string | null;
    urlPicto?: string | null;
    cropAspectFormat?: string | null;
    cropShape?: string | null;
  };
};

export function coverUrlMatchesMedia(
  coverImageUrl: string,
  media: CoverMediaRef["media"]
): boolean {
  return (
    media.urlOrigin === coverImageUrl ||
    media.urlGrande === coverImageUrl ||
    media.urlMoyenne === coverImageUrl ||
    media.urlPetite === coverImageUrl ||
    media.urlPicto === coverImageUrl
  );
}

/** Resolve crop format for the post cover from PostMedia links + coverImageUrl. */
export function resolveCoverCropAspectFormat(
  coverImageUrl: string | null | undefined,
  mediaLinks: CoverMediaRef[]
): CropAspectFormat {
  const coverLink = mediaLinks.find((l) => l.isCover);
  if (coverLink) {
    return resolveCropAspectFormat(coverLink.media.cropAspectFormat);
  }
  if (coverImageUrl) {
    const byUrl = mediaLinks.find((l) =>
      coverUrlMatchesMedia(coverImageUrl, l.media)
    );
    if (byUrl) {
      return resolveCropAspectFormat(byUrl.media.cropAspectFormat);
    }
  }
  return "PORTRAIT_3_4";
}

export function coverDisplayAspectRatio(
  format?: CropAspectFormat | string | null
): string {
  return String(imageAspectForFormat(resolveCropAspectFormat(format)));
}

export function coverDisplayIsCircle(
  format?: CropAspectFormat | string | null,
  cropShape?: string | null
): boolean {
  const resolved = resolveCropAspectFormat(format);
  return resolved === "CIRCLE" || cropShape === "CIRCLE";
}
