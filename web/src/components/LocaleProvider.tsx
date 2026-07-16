"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { t, type MessageKey } from "@/lib/i18n";
import {
  detectBrowserLocale,
  readStoredLocale,
  resolveInitialLocale,
  writeStoredLocale,
  type Locale,
} from "@/lib/locale";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  ready: boolean;
  t: (key: MessageKey) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("fr");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLocaleState(resolveInitialLocale());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = locale;
  }, [locale, ready]);

  const setLocale = useCallback((next: Locale) => {
    writeStoredLocale(next);
    setLocaleState(next);
  }, []);

  const translate = useCallback((key: MessageKey) => t(key, locale), [locale]);

  const value = useMemo(
    () => ({ locale, setLocale, ready, t: translate }),
    [locale, setLocale, ready, translate]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return ctx;
}

/** SSR-safe default before hydration (browser detection runs in provider effect). */
export function getDefaultLocale(): Locale {
  return readStoredLocale() ?? detectBrowserLocale();
}
