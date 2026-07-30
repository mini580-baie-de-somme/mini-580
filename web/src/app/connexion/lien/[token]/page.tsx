import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { WebConnectLinkStatus } from "@/components/WebConnectLinkStatus";
import { createSessionToken, sessionCookieOptions } from "@/lib/auth";
import { redeemWebConnectLink } from "@/lib/web-connect-link";

type PageProps = { params: Promise<{ token: string }> };

export const metadata = {
  title: "Connexion automatique",
  robots: { index: false, follow: false },
};

export default async function WebConnectLinkPage({ params }: PageProps) {
  const { token } = await params;
  const result = await redeemWebConnectLink(token);

  if (!result.ok) {
    const reason =
      result.reason === "invalid_user" ? "invalid_user" : result.reason;
    return <WebConnectLinkStatus reason={reason} />;
  }

  const sessionToken = await createSessionToken({
    id: result.userId,
    email: result.email,
    name: result.name,
  });

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieOptions(sessionToken));

  redirect("/editeur");
}
