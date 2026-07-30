import Link from "next/link";

type Props = {
  reason: "expired" | "used" | "not_found" | "invalid_user";
};

const MESSAGES: Record<Props["reason"], { title: string; body: string }> = {
  expired: {
    title: "Lien expiré",
    body: "Ce lien de connexion n'est plus valide (durée : 5 minutes). Demande un nouveau lien à un administrateur via Telegram.",
  },
  used: {
    title: "Lien déjà utilisé",
    body: "Ce lien de connexion a déjà servi. Demande un nouveau lien à un administrateur si tu dois te reconnecter.",
  },
  not_found: {
    title: "Lien invalide",
    body: "Ce lien de connexion est incorrect ou n'existe plus. Vérifie l'URL ou demande un nouveau lien à un administrateur.",
  },
  invalid_user: {
    title: "Compte indisponible",
    body: "Ce compte n'est plus actif. Contacte un administrateur.",
  },
};

export function WebConnectLinkStatus({ reason }: Props) {
  const { title, body } = MESSAGES[reason];

  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <div className="rounded-lg border border-[#E8ECEF] bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-[#0D131A]">{title}</h1>
        <p className="mt-4 text-sm leading-relaxed text-[#495867]">{body}</p>
        <Link
          href="/connexion"
          className="mt-8 inline-block rounded-md bg-[#0D131A] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1a2330]"
        >
          Aller à la connexion
        </Link>
      </div>
    </div>
  );
}
