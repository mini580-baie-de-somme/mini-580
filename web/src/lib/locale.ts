export type Locale = "fr" | "en";

export const LOCALE_STORAGE_KEY = "mini580-locale";

/** Browser default: fr_* → fr, en_* → en, otherwise en */
export function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return "fr";

  const candidates = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];

  for (const raw of candidates) {
    const code = raw.toLowerCase();
    if (code.startsWith("fr")) return "fr";
    if (code.startsWith("en")) return "en";
  }

  return "en";
}

export function readStoredLocale(): Locale | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return stored === "fr" || stored === "en" ? stored : null;
}

export function writeStoredLocale(locale: Locale): void {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

export function resolveInitialLocale(): Locale {
  return readStoredLocale() ?? detectBrowserLocale();
}
