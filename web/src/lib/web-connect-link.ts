import "server-only";

import { randomBytes } from "node:crypto";
import { UserStatus } from "@/generated/prisma/client";
import { appLog } from "@/lib/app-log";
import {
  createAdminWebConnectOtpChallenge,
  OTP_TTL_MS,
  redeemOtpChallengeById,
} from "@/lib/auth-otp";
import { prisma } from "@/lib/db";
import { getPublicSiteBaseUrl } from "@/lib/site-url";
import { toUserDto, type UserDto } from "@/lib/users";

export type WebConnectCopyPaste = {
  connectUrl: string;
  otpCode: string;
  copyPasteMessage: string;
  expiresAt: string;
};

export function buildWebConnectUrl(token: string): string {
  return `${getPublicSiteBaseUrl()}/connexion/lien/${token}`;
}

export function buildWebConnectCopyPaste(input: {
  firstName: string;
  email: string;
  connectUrl: string;
  otpCode: string;
  expiresAt: Date;
}): WebConnectCopyPaste {
  const expiresTime = input.expiresAt.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const loginUrl = `${getPublicSiteBaseUrl()}/connexion`;

  const copyPasteMessage = [
    `Salut ${input.firstName},`,
    "",
    "Connexion web Class Mini 5.80 (lien valide 5 minutes) :",
    "",
    "Option 1 — clic direct :",
    input.connectUrl,
    "",
    "Option 2 — connexion manuelle :",
    loginUrl,
    `Email : ${input.email}`,
    `Code : ${input.otpCode}`,
    "Onglet « Code Telegram » si besoin.",
    "",
    `Expire à ${expiresTime}. Demande un nouveau lien à l'admin si expiré.`,
  ].join("\n");

  return {
    connectUrl: input.connectUrl,
    otpCode: input.otpCode,
    copyPasteMessage,
    expiresAt: input.expiresAt.toISOString(),
  };
}

export type CreateWebConnectLinkResult =
  | { ok: true; user: UserDto; connect: WebConnectCopyPaste }
  | { ok: false; status: number; error: string };

export async function createWebConnectLink(input: {
  userId: string;
  createdById?: string;
}): Promise<CreateWebConnectLinkResult> {
  appLog("web-connect", "info", "create", {
    userId: input.userId,
    createdById: input.createdById,
  });

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      name: true,
      telegramUserId: true,
      status: true,
      isAdmin: true,
      createdAt: true,
    },
  });

  if (!user) {
    return { ok: false, status: 404, error: "Utilisateur introuvable" };
  }

  if (user.status !== UserStatus.ACTIVE) {
    return {
      ok: false,
      status: 400,
      error: "Seuls les utilisateurs ACTIVE peuvent recevoir un lien de connexion",
    };
  }

  const otp = await createAdminWebConnectOtpChallenge({ email: user.email });
  if (!otp.ok) {
    return { ok: false, status: otp.status, error: otp.error };
  }

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await prisma.$transaction(async (tx) => {
    await tx.webConnectLink.updateMany({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });

    await tx.webConnectLink.create({
      data: {
        token,
        userId: user.id,
        otpChallengeId: otp.challengeId,
        expiresAt,
        createdById: input.createdById ?? null,
      },
    });
  });

  const connectUrl = buildWebConnectUrl(token);
  const firstName = user.firstName || user.name?.split(/\s+/)[0] || "Bonjour";
  const connect = buildWebConnectCopyPaste({
    firstName,
    email: user.email,
    connectUrl,
    otpCode: otp.code,
    expiresAt,
  });

  appLog("web-connect", "info", "created", {
    userId: user.id,
    email: user.email,
    expiresAt: expiresAt.toISOString(),
  });

  return { ok: true, user: toUserDto(user), connect };
}

export type RedeemWebConnectLinkResult =
  | { ok: true; userId: string; email: string; name: string | null }
  | { ok: false; reason: "not_found" | "expired" | "used" | "invalid_user" };

export async function redeemWebConnectLink(
  token: string
): Promise<RedeemWebConnectLinkResult> {
  const trimmed = token.trim();
  if (!/^[a-f0-9]{48}$/.test(trimmed)) {
    return { ok: false, reason: "not_found" };
  }

  appLog("web-connect", "info", "redeem_attempt", { tokenPrefix: trimmed.slice(0, 8) });

  const link = await prisma.webConnectLink.findUnique({
    where: { token: trimmed },
    include: {
      user: {
        select: { id: true, email: true, name: true, status: true },
      },
    },
  });

  if (!link) {
    return { ok: false, reason: "not_found" };
  }

  if (link.usedAt) {
    return { ok: false, reason: "used" };
  }

  if (link.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  if (link.user.status !== UserStatus.ACTIVE) {
    return { ok: false, reason: "invalid_user" };
  }

  if (!link.otpChallengeId) {
    return { ok: false, reason: "expired" };
  }

  const verified = await redeemOtpChallengeById(link.otpChallengeId);
  if (!verified.ok) {
    return { ok: false, reason: "expired" };
  }

  appLog("web-connect", "info", "redeemed", {
    userId: verified.userId,
    email: verified.email,
  });

  return {
    ok: true,
    userId: verified.userId,
    email: verified.email,
    name: verified.name,
  };
}
