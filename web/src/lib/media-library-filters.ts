import type { MediaKindClient } from "@/lib/media-file-client";

export type MediaLibraryVisibilityFilter = "ALL" | "public" | "draft" | "orphan";

export const MEDIA_LIBRARY_FILTER_KEYS = [
  "q",
  "kind",
  "visibility",
  "groupId",
] as const;

export function mediaLibraryFiltersFromParams(searchParams: URLSearchParams) {
  return {
    q: searchParams.get("q")?.trim() ?? "",
    kind: (searchParams.get("kind") ?? "ALL") as "ALL" | MediaKindClient,
    visibility: (searchParams.get("visibility") ??
      "ALL") as MediaLibraryVisibilityFilter,
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
