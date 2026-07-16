"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { editorNav, isNavActive, publicNav } from "@/lib/nav-config";
import { LangToggle } from "./LangToggle";
import { useLocale } from "./LocaleProvider";

type AppUser = {
  id: string;
  email: string;
  name: string | null;
} | null;

function BurgerIcon({ open }: { open: boolean }) {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      {open ? (
        <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
      ) : (
        <>
          <path strokeLinecap="round" d="M4 7h16" />
          <path strokeLinecap="round" d="M4 12h16" />
          <path strokeLinecap="round" d="M4 17h16" />
        </>
      )}
    </svg>
  );
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-3 group min-w-0">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#495867] text-xs font-bold text-white">
        580
      </span>
      {!compact && (
        <p className="text-sm font-semibold tracking-wide text-[#0D131A] group-hover:text-[#495867] leading-snug">
          Class Mini 5.80 Baie de Somme
        </p>
      )}
    </Link>
  );
}

function NavLinks({
  user,
  onNavigate,
}: {
  user: AppUser;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { t } = useLocale();

  const linkClass = (href: string, primary?: boolean) => {
    const active = isNavActive(pathname, href);
    if (active) {
      return "flex items-center gap-2 rounded-md border-l-2 border-[#495867] bg-[#eef3f7] px-3 py-2.5 text-sm font-medium text-[#0D131A]";
    }
    if (primary) {
      return "flex items-center gap-2 rounded-md bg-[#495867] px-3 py-2.5 text-sm font-medium text-white hover:bg-[#3a4654]";
    }
    return "flex items-center gap-2 rounded-md px-3 py-2.5 text-sm text-[#0D131A] hover:bg-[#eef3f7] hover:text-[#495867]";
  };

  return (
    <nav className="flex flex-col gap-1">
      <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-[#495867]/70">
        {t("nav.sectionSite")}
      </p>
      {publicNav.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          className={linkClass(item.href)}
        >
          {t(item.key)}
        </Link>
      ))}

      <p className="mt-4 px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-[#495867]/70">
        {user ? t("nav.sectionEditor") : t("nav.sectionAccount")}
      </p>
      {user ? (
        editorNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={linkClass(item.href, item.primary)}
          >
            {t(item.key)}
          </Link>
        ))
      ) : (
        <Link
          href="/connexion"
          onClick={onNavigate}
          className={linkClass("/connexion")}
        >
          {t("nav.login")}
        </Link>
      )}
    </nav>
  );
}

export function AppShell({ user, children }: { user: AppUser; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const { locale, setLocale, t } = useLocale();

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    closeMenu();
  }, [pathname, closeMenu]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [menuOpen, closeMenu]);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col lg:border-r lg:border-[#d4dde6] lg:bg-white">
        <div className="border-b border-[#d4dde6] px-4 py-5">
          <BrandMark />
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto px-3 py-4">
          <NavLinks user={user} />
        </div>
        <div className="border-t border-[#d4dde6] px-4 py-4">
          <LangToggle lang={locale} onChange={setLocale} />
        </div>
      </aside>

      {/* Mobile drawer */}
      {menuOpen && (
        <button
          type="button"
          aria-label={t("nav.closeMenu")}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={closeMenu}
        />
      )}
      <aside
        id="mobile-nav"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-[#d4dde6] bg-white shadow-xl transition-transform duration-200 lg:hidden ${
          menuOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
        }`}
        aria-hidden={!menuOpen}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[#d4dde6] px-4 py-4">
          <BrandMark compact />
          <button
            type="button"
            onClick={closeMenu}
            className="rounded-md p-2 text-[#495867] hover:bg-[#eef3f7]"
            aria-label={t("nav.closeMenu")}
          >
            <BurgerIcon open />
          </button>
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto px-3 py-4">
          <NavLinks user={user} onNavigate={closeMenu} />
        </div>
        <div className="border-t border-[#d4dde6] px-4 py-4">
          <LangToggle lang={locale} onChange={setLocale} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[#d4dde6] bg-white/90 px-4 py-3 backdrop-blur-sm lg:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-md p-2 text-[#495867] hover:bg-[#eef3f7]"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
          >
            <BurgerIcon open={menuOpen} />
          </button>
          <BrandMark compact />
          <LangToggle lang={locale} onChange={setLocale} />
        </header>

        {children}
      </div>
    </div>
  );
}
