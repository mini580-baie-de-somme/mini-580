/** Client-safe media-library visibility classification (public / draft / orphan). */

export type MediaLibraryVisibility = "public" | "draft" | "orphan";

export type ResolveMediaLibraryVisibilityInput = {
  /** Prefer server-computed field when present. */
  visibility?: MediaLibraryVisibility | null;
  /** Post statuses from PostMedia links (cover + standalone). */
  postStatuses?: Array<"DRAFT" | "PUBLISHED" | "ARCHIVED" | undefined | null>;
  /** Explicit PostMedia presence (when statuses array is empty but links exist). */
  hasPostMediaLink?: boolean;
  /** Member of a MediaGroup referenced in a PUBLISHED post body. */
  referencedByPublishedGroup?: boolean;
  /** Member of a MediaGroup referenced in any post body. */
  referencedByAnyGroup?: boolean;
};

/**
 * Resolve badge visibility for a media-library row.
 * Rules match server `mediaWhere` visibility filters:
 * - public: PostMedia on PUBLISHED OR group referenced in PUBLISHED body
 * - draft: article-linked (PostMedia any / group in any body) and not public
 * - orphan: no PostMedia and not in any body-referenced group
 */
export function resolveMediaLibraryVisibility(
  input: ResolveMediaLibraryVisibilityInput
): MediaLibraryVisibility {
  if (
    input.visibility === "public" ||
    input.visibility === "draft" ||
    input.visibility === "orphan"
  ) {
    return input.visibility;
  }

  const statuses = input.postStatuses ?? [];
  const hasPostLink = input.hasPostMediaLink ?? statuses.length > 0;
  const isPublic =
    statuses.some((s) => s === "PUBLISHED") ||
    Boolean(input.referencedByPublishedGroup);
  if (isPublic) return "public";

  if (hasPostLink || input.referencedByAnyGroup) return "draft";
  return "orphan";
}
