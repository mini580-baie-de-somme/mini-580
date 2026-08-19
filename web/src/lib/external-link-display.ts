import type { ExternalLinkTokenMeta } from "@/lib/external-link-token";

/** Resolve a human label for an external link chip (never stored in body tokens). */
export function resolveExternalLinkDisplayName(
  link: ExternalLinkTokenMeta,
  locale: "fr" | "en",
  _linkId: string
): string {
  const localized =
    locale === "fr"
      ? link.labelFr?.trim() || link.labelEn?.trim()
      : link.labelEn?.trim() || link.labelFr?.trim();
  if (localized) return localized;
  return locale === "fr" ? "Lien sans libellé" : "Untitled link";
}

/** Short immutable id hint for editors (first 8 chars). */
export function externalLinkIdHint(linkId: string): string {
  return linkId.slice(0, 8);
}

/** Browser event fired when an external link is saved in the admin editor. */
export const EXTERNAL_LINK_UPDATED_EVENT = "external-link-updated";

export function dispatchExternalLinkUpdated(linkId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(EXTERNAL_LINK_UPDATED_EVENT, { detail: { linkId } })
  );
}
