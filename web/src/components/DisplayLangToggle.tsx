"use client";

import { LangToggle } from "./LangToggle";
import { useLocale } from "./LocaleProvider";

/** Site UI display language (LocaleProvider), distinct from content-editing lang in PostEditor. */
export function DisplayLangToggle() {
  const { locale, setLocale } = useLocale();
  return <LangToggle lang={locale} onChange={setLocale} />;
}
