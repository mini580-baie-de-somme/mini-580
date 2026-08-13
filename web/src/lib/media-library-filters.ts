import type { MediaKindClient } from "@/lib/media-file-client";

export type MediaLibraryVisibilityFilter = "ALL" | "public" | "draft" | "orphan";

export const MEDIA_LIBRARY_FILTER_KEYS = [
  "q",
  "kind",
  "visibility",
  "groupId",
] as const;

function normalizeKindParam(value: string | null): "ALL" | MediaKindClient {
  const kind = value?.trim();
  if (!kind || kind === "ALL") return "ALL";
  return kind as MediaKindClient;
}

function normalizeVisibilityParam(
  value: string | null
): MediaLibraryVisibilityFilter {
  const visibility = value?.trim();
  if (!visibility || visibility === "ALL") return "ALL";
  return visibility as MediaLibraryVisibilityFilter;
}

export function mediaLibraryFiltersFromParams(searchParams: URLSearchParams) {
  return {
    q: searchParams.get("q")?.trim() ?? "",
    kind: normalizeKindParam(searchParams.get("kind")),
    visibility: normalizeVisibilityParam(searchParams.get("visibility")),
    groupFilterId: searchParams.get("groupId")?.trim() ?? "",
  };
}

/** API list query string — ignores virtual overlay keys (`media`, `group`). */
export function mediaLibraryListQueryString(searchParams: URLSearchParams): string {
  const { q, kind, visibility, groupFilterId } =
    mediaLibraryFiltersFromParams(searchParams);
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (kind !== "ALL") params.set("kind", kind);
  if (visibility !== "ALL") params.set("visibility", visibility);
  if (groupFilterId) params.set("groupId", groupFilterId);
  return params.toString();
}
