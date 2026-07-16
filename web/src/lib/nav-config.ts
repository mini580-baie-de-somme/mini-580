import type { MessageKey } from "./i18n";

export type NavItem = {
  href: string;
  key: MessageKey;
  /** Primary CTA style (e.g. editor home) */
  primary?: boolean;
};

export const publicNav: NavItem[] = [
  { href: "/", key: "nav.home" },
  { href: "/blog", key: "nav.blog" },
  { href: "/galerie", key: "nav.gallery" },
  { href: "/timeline", key: "nav.timeline" },
];

export const editorNav: NavItem[] = [
  { href: "/editeur", key: "nav.editor", primary: true },
  { href: "/editeur/jalons", key: "nav.milestones" },
  { href: "/editeur/sync", key: "nav.sync" },
];

/** Active state for sidebar links (handles /editeur vs sub-routes). */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";

  if (href === "/editeur") {
    if (pathname === "/editeur" || pathname === "/editeur/nouveau") return true;
    if (/^\/editeur\/[^/]+$/.test(pathname)) {
      const rest = pathname.slice("/editeur/".length);
      return rest !== "jalons" && rest !== "sync";
    }
    return false;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
