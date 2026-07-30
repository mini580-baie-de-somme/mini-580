"use client";

import { LangToggle } from "./LangToggle";
import { useLocale } from "./LocaleProvider";

/** Site UI display language (LocaleProvider), distinct from content-editing lang in PostEditor. */
export function DisplayLangToggle() {
  const { locale, setLocale, t } = useLocale();
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-[#495867]/70">
        {t("lang.display")}
      </span>
      <LangToggle lang={locale} onChange={setLocale} />
    </div>
  );
}
