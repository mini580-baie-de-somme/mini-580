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
  { href: "/editeur/galerie", key: "nav.mediaLibrary" },
  { href: "/editeur/jalons", key: "nav.milestones" },
  { href: "/editeur/themes", key: "nav.themes" },
  { href: "/editeur/tags", key: "nav.tags" },
  { href: "/editeur/sync", key: "nav.sync" },
];

const editorSubRoutes = new Set(["jalons", "sync", "themes", "tags", "galerie"]);

/** Active state for sidebar links (handles /editeur vs sub-routes). */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";

  if (href === "/editeur") {
    if (pathname === "/editeur" || pathname === "/editeur/nouveau") return true;
    if (/^\/editeur\/[^/]+$/.test(pathname)) {
      const rest = pathname.slice("/editeur/".length);
      return !editorSubRoutes.has(rest);
    }
    return false;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
