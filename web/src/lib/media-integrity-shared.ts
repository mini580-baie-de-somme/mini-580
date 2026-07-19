/** Client-safe media integrity helpers (no server-only imports). */

export type MediaExternalUrlRole =
  | "origin"
  | "picto"
  | "petite"
  | "moyenne"
  | "grande";

export type MediaExternalUrl = {
  role: MediaExternalUrlRole;
  url: string;
};

export function isRemoteMediaUrl(url: string): boolean {
  const trimmed = url.trim();
  return trimmed.startsWith("http://") || trimmed.startsWith("https://");
}

export function collectExternalMediaUrls(input: {
  urlOrigin: string;
  urlPicto?: string | null;
  urlPetite?: string | null;
  urlMoyenne?: string | null;
  urlGrande?: string | null;
}): MediaExternalUrl[] {
  const entries: Array<[MediaExternalUrlRole, string | null | undefined]> = [
    ["origin", input.urlOrigin],
    ["picto", input.urlPicto],
    ["petite", input.urlPetite],
    ["moyenne", input.urlMoyenne],
    ["grande", input.urlGrande],
  ];
  const seen = new Set<string>();
  const out: MediaExternalUrl[] = [];
  for (const [role, url] of entries) {
    if (!url || !isRemoteMediaUrl(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ role, url });
  }
  return out;
}

export function externalUrlRoleLabel(
  role: MediaExternalUrlRole,
  locale: "fr" | "en"
): string {
  const labels: Record<MediaExternalUrlRole, { fr: string; en: string }> = {
    origin: { fr: "Originale", en: "Original" },
    picto: { fr: "Picto", en: "Thumb" },
    petite: { fr: "Petite", en: "Small" },
    moyenne: { fr: "Moyenne", en: "Medium" },
    grande: { fr: "Grande", en: "Large" },
  };
  return labels[role][locale];
}
