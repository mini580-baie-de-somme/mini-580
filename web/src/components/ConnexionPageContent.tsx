"use client";

import { LoginForm } from "@/components/LoginForm";
import { useLocale } from "@/components/LocaleProvider";

export function ConnexionPageContent() {
  const { t } = useLocale();

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-lg text-center">
        <h1 className="text-2xl font-semibold text-[#0D131A]">{t("login.title")}</h1>
        <p className="mt-2 text-sm text-[#495867]">{t("login.subtitle")}</p>
      </div>
      <div className="mt-8">
        <LoginForm />
      </div>
    </div>
  );
}
