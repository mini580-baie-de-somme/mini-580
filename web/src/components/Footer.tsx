import { CLASS_GLOBE_LINKS } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-[#d4dde6] bg-[#f4f7fa]">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <p className="font-semibold text-[#0D131A]">CNBS — Chantier Naval de la Baie de Somme</p>
            <p className="mt-2 text-sm text-[#495867]">
              Construction de trois Class Globe 5.80 — coques #268, #269 et #270.
            </p>
          </div>
          <div>
            <p className="font-semibold text-[#0D131A]">Class Globe 5.80</p>
            <ul className="mt-2 space-y-1 text-sm">
              <li>
                <a
                  href={CLASS_GLOBE_LINKS.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#495867] hover:underline"
                >
                  Site officiel
                </a>
              </li>
              <li>
                <a
                  href={CLASS_GLOBE_LINKS.builders}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#495867] hover:underline"
                >
                  Blogs constructeurs
                </a>
              </li>
              <li>
                <a
                  href={CLASS_GLOBE_LINKS.transat}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#495867] hover:underline"
                >
                  Globe 5.80 Transat
                </a>
              </li>
            </ul>
          </div>
        </div>
        <p className="mt-8 text-center text-xs text-[#495867]">
          Les vieux fourneaux — documentation bilingue FR/EN
        </p>
      </div>
    </footer>
  );
}
