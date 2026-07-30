import "server-only";

import { UserStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getPublicSiteBaseUrl } from "@/lib/site-url";
import type { BotReply } from "@/lib/telegram/publish-flow";

type TelegramUser = { id: number; username?: string; first_name?: string };

const OTP_MAX_ATTEMPTS = 5;

async function hasActiveOtpSessionForTelegramUser(telegramUserId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { telegramUserId },
    select: { id: true, email: true },
  });
  if (!user) return false;

  const now = new Date();
  const [activeOtp, activeWebConnect] = await Promise.all([
    prisma.authOtpChallenge.findFirst({
      where: {
        email: user.email,
        expiresAt: { gt: now },
        attempts: { lt: OTP_MAX_ATTEMPTS },
      },
      select: { id: true },
    }),
    prisma.webConnectLink.findFirst({
      where: {
        userId: user.id,
        expiresAt: { gt: now },
        usedAt: null,
      },
      select: { id: true },
    }),
  ]);

  return !!(activeOtp || activeWebConnect);
}

/** Welcome message for Telegram users who are not yet authorized. */
export async function buildUnauthorizedWelcome(from: TelegramUser): Promise<BotReply> {
  const telegramUserId = String(from.id);
  const label = [from.first_name, from.username ? `@${from.username}` : null]
    .filter(Boolean)
    .join(" ");

  const knownUser = await prisma.user.findUnique({
    where: { telegramUserId },
    select: { status: true },
  });
  const pendingOtpSession = await hasActiveOtpSessionForTelegramUser(telegramUserId);

  const lines = [
    "👋 Bienvenue Class Mini 5.80",
    "",
    `Ton ID Telegram : \`${from.id}\`${label ? `\n(${label})` : ""}`,
    "",
  ];

  if (
    knownUser?.status === UserStatus.INACTIVE ||
    knownUser?.status === UserStatus.ARCHIVED
  ) {
    lines.push("Ton compte est désactivé — contacte un admin.");
  } else {
    lines.push(
      "Transmets cet ID à un admin, ou ouvre le lien d'invitation qu'il t'a envoyé (`/start inv_…`)."
    );

    if (!knownUser && !pendingOtpSession) {
      const siteUrl = getPublicSiteBaseUrl();
      lines.push(
        "",
        `Blog : ${siteUrl}/blog`,
        `Connexion web (si tu as déjà un compte) : ${siteUrl}/connexion`,
        "Onglet « Code Telegram » — le code OTP t'est envoyé ici."
      );
    }
  }

  return { text: lines.join("\n") };
}
