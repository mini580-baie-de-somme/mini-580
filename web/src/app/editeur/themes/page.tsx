import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ThemeManager } from "@/components/ThemeManager";

export const metadata = {
  title: "Thématiques",
};

export default async function ThemesPage() {
  const session = await getSession();
  if (!session) redirect("/connexion");

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <ThemeManager />
    </div>
  );
}
