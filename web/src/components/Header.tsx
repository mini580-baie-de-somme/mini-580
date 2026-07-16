import Link from "next/link";
import { getSessionUserFromDb } from "@/lib/auth";
import { HeaderActions } from "./HeaderActions";

export async function Header() {
  const user = await getSessionUserFromDb();

  return (
    <header className="border-b border-[#d4dde6] bg-white/90 backdrop-blur-sm sticky top-0 z-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3 group">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#495867] text-xs font-bold text-white">
            580
          </span>
          <div>
            <p className="text-sm font-semibold tracking-wide text-[#0D131A] group-hover:text-[#495867]">
              Mini5.80 Baie de Somme
            </p>
          </div>
        </Link>

        <HeaderActions user={user} />
      </div>
    </header>
  );
}
