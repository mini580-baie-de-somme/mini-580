/** Client-safe poster/thumbnail helpers for VIDEO and DOCUMENT media. */

import { resolveThumbKind, type MediaKindClient } from "@/lib/media-file-client";

export type MediaPosterSummary = {
  id: string;
  kind?: string | null;
  mimeType?: string | null;
  urlOrigin: string;
  urlPicto: string | null;
  urlPetite: string | null;
  urlMoyenne: string | null;
  urlGrande: string | null;
  titleFr?: string;
  titleEn?: string;
};

export type MediaThumbSource = {
  kind?: string | null;
  mimeType?: string | null;
  urlOrigin?: string | null;
  urlPicto?: string | null;
  urlPetite?: string | null;
  urlMoyenne?: string | null;
  urlGrande?: string | null;
  posterMediaId?: string | null;
  poster?: MediaPosterSummary | null;
};

/** IMAGE variants preferred for a poster row. */
export function posterImageSrc(
  poster: MediaPosterSummary | null | undefined
): string | null {
  if (!poster) return null;
  return (
    poster.urlPicto ||
    poster.urlPetite ||
    poster.urlMoyenne ||
    poster.urlGrande ||
    poster.urlOrigin ||
    null
  );
}

/**
 * Resolve list/tile thumb URL:
 * VIDEO|DOCUMENT with poster → poster image variants;
 * IMAGE → own variants;
 * otherwise null (caller shows MediaKindThumb pictogram).
 */
export function resolveMediaThumbSrc(media: MediaThumbSource): string | null {
  const kind = resolveThumbKind(media.kind, media.mimeType, media.urlOrigin);
  if (kind === "VIDEO" || kind === "DOCUMENT") {
    return posterImageSrc(media.poster);
  }
  if (kind === "IMAGE") {
    return (
      media.urlPicto ||
      media.urlPetite ||
      media.urlMoyenne ||
      media.urlGrande ||
      media.urlOrigin ||
      null
    );
  }
  return media.urlPicto || media.urlMoyenne || null;
}

export function mediaSupportsPoster(
  kind: string | null | undefined
): kind is "VIDEO" | "DOCUMENT" {
  return kind === "VIDEO" || kind === "DOCUMENT";
}

export type PosterAssignInput = {
  sourceId: string;
  sourceKind: string;
  posterMediaId: string | null;
  poster: { id: string; kind: string } | null;
};

export type PosterAssignResult =
  | { ok: true; posterMediaId: string | null }
  | { ok: false; status: 400; error: string };

/** Pure validation for PATCH posterMediaId (DB existence checked by caller). */
export function validatePosterAssignment(
  input: PosterAssignInput
): PosterAssignResult {
  const { sourceId, sourceKind, posterMediaId, poster } = input;

  if (!mediaSupportsPoster(sourceKind)) {
    return {
      ok: false,
      status: 400,
      error: "posterMediaId is only allowed on VIDEO or DOCUMENT media",
    };
  }

  if (posterMediaId === null) {
    return { ok: true, posterMediaId: null };
  }

  if (posterMediaId === sourceId) {
    return {
      ok: false,
      status: 400,
      error: "posterMediaId cannot reference the same media",
    };
  }

  if (!poster) {
    return { ok: false, status: 400, error: "Poster media not found" };
  }

  if (poster.kind !== "IMAGE") {
    return {
      ok: false,
      status: 400,
      error: "posterMediaId must point to an IMAGE media",
    };
  }

  return { ok: true, posterMediaId };
}

export function serializePosterSummary(
  poster: MediaPosterSummary | null | undefined
): MediaPosterSummary | null {
  if (!poster) return null;
  return {
    id: poster.id,
    kind: poster.kind ?? "IMAGE",
    mimeType: poster.mimeType ?? null,
    urlOrigin: poster.urlOrigin,
    urlPicto: poster.urlPicto ?? null,
    urlPetite: poster.urlPetite ?? null,
    urlMoyenne: poster.urlMoyenne ?? null,
    urlGrande: poster.urlGrande ?? null,
    titleFr: poster.titleFr ?? "",
    titleEn: poster.titleEn ?? "",
  };
}

export type KindThumbDisplay =
  | { mode: "poster"; kind: Extract<MediaKindClient, "VIDEO" | "DOCUMENT">; src: string }
  | { mode: "icon"; kind: MediaKindClient }
  | { mode: "image"; src: string }
  | { mode: "unknown" };

/** Decide how MediaKindThumb should render (poster + badge vs icon vs image). */
export function resolveKindThumbDisplay(opts: {
  kind?: string | null;
  mimeType?: string | null;
  src?: string | null;
}): KindThumbDisplay {
  const resolved = resolveThumbKind(opts.kind, opts.mimeType, opts.src);
  const path = (opts.src ?? "").split("?")[0].toLowerCase();
  const srcLooksLikeNonImage =
    path.endsWith(".pdf") || path.endsWith(".mp4") || path.endsWith(".webm");
  const src = opts.src && !srcLooksLikeNonImage ? opts.src : null;

  if ((resolved === "VIDEO" || resolved === "DOCUMENT") && src) {
    return { mode: "poster", kind: resolved, src };
  }
  if (resolved === "DOCUMENT" || resolved === "VIDEO") {
    return { mode: "icon", kind: resolved };
  }
  if (src) {
    return { mode: "image", src };
  }
  if (resolved === "IMAGE") {
    return { mode: "unknown" };
  }
  return { mode: "icon", kind: resolved };
}
