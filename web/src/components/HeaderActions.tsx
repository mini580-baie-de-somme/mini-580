"use client";

import Link from "next/link";
import { LangToggle } from "./LangToggle";
import { useLocale } from "./LocaleProvider";

type HeaderUser = {
  id: string;
  email: string;
  name: string | null;
} | null;

const navKeys = [
  { href: "/", key: "nav.home" as const },
  { href: "/blog", key: "nav.blog" as const },
  { href: "/timeline", key: "nav.timeline" as const },
];

export function HeaderActions({ user }: { user: HeaderUser }) {
  const { locale, setLocale, t } = useLocale();

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <nav className="flex flex-wrap items-center gap-1 sm:gap-2">
        {navKeys.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-md px-3 py-2 text-sm text-[#0D131A] hover:bg-[#eef3f7] hover:text-[#495867]"
          >
            {t(item.key)}
          </Link>
        ))}
        {user ? (
          <Link
            href="/editeur"
            className="rounded-md bg-[#495867] px-3 py-2 text-sm text-white hover:bg-[#3a4654]"
          >
            {t("nav.editor")}
          </Link>
        ) : (
          <Link
            href="/connexion"
            className="rounded-md px-3 py-2 text-sm text-[#495867] hover:bg-[#eef3f7]"
          >
            {t("nav.login")}
          </Link>
        )}
      </nav>
      <LangToggle lang={locale} onChange={setLocale} />
    </div>
  );
}
