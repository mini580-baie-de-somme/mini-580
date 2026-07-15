import Link from "next/link";
import { getSessionUserFromDb } from "@/lib/auth";

const nav = [
  { href: "/", label: "Accueil" },
  { href: "/blog", label: "Blog" },
  { href: "/timeline", label: "Timeline" },
];

export async function Header() {
  const user = await getSessionUserFromDb();

  return (
    <header className="border-b border-[#d4dde6] bg-white/90 backdrop-blur-sm sticky top-0 z-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3 group">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#495867] text-sm font-bold text-white">
            CN
          </span>
          <div>
            <p className="text-sm font-semibold tracking-wide text-[#0D131A] group-hover:text-[#495867]">
              CNBS
            </p>
            <p className="text-xs text-[#495867]">Baie de Somme</p>
          </div>
        </Link>

        <nav className="flex flex-wrap items-center gap-1 sm:gap-2">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm text-[#0D131A] hover:bg-[#eef3f7] hover:text-[#495867]"
            >
              {item.label}
            </Link>
          ))}
          {user ? (
            <Link
              href="/editeur"
              className="rounded-md bg-[#495867] px-3 py-2 text-sm text-white hover:bg-[#3a4654]"
            >
              Éditeur
            </Link>
          ) : (
            <Link
              href="/connexion"
              className="rounded-md px-3 py-2 text-sm text-[#495867] hover:bg-[#eef3f7]"
            >
              Connexion
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
