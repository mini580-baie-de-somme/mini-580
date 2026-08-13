/** Resolve a human label for a media group chip (never stored in body tokens). */
export function resolveMediaGroupDisplayName(
  group: {
    titleFr?: string | null;
    titleEn?: string | null;
    slug?: string | null;
  },
  locale: "fr" | "en",
  groupId: string
): string {
  const localized =
    locale === "fr"
      ? group.titleFr?.trim() || group.titleEn?.trim()
      : group.titleEn?.trim() || group.titleFr?.trim();
  if (localized) return localized;
  if (group.slug?.trim()) return group.slug.trim();
  return locale === "fr" ? "Groupe sans titre" : "Untitled group";
}

/** Short immutable id hint for editors (first 8 chars). */
export function mediaGroupIdHint(groupId: string): string {
  return groupId.slice(0, 8);
}

/** Browser event fired when a media group is saved in the editor overlay. */
export const MEDIA_GROUP_UPDATED_EVENT = "media-group-updated";

export function dispatchMediaGroupUpdated(groupId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(MEDIA_GROUP_UPDATED_EVENT, { detail: { groupId } })
  );
}
