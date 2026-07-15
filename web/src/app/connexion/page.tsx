import { LoginForm } from "@/components/LoginForm";

export const metadata = {
  title: "Connexion",
};

export default function ConnexionPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-lg text-center">
        <h1 className="text-2xl font-semibold text-[#0D131A]">Connexion éditeur</h1>
        <p className="mt-2 text-sm text-[#495867]">
          Accès réservé aux membres de l&apos;équipe CNBS (allowlist email).
        </p>
      </div>
      <div className="mt-8">
        <LoginForm />
      </div>
    </div>
  );
}
