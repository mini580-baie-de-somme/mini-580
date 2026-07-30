import "server-only";

import { randomInt } from "node:crypto";
import { UserStatus } from "@/generated/prisma/client";
import { appLog } from "@/lib/app-log";
import { OTP_ONLY_PASSWORD_HASH } from "@/lib/auth-constants";
import { prisma } from "@/lib/db";
import { getTelegramBotUsername } from "@/lib/telegram/api";
import { deriveUserName } from "@/lib/user-names";
import { toUserDto, type UserDto } from "@/lib/users";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const INVITE_TOKEN_LEN = 8;
/** Avoid ambiguous glyphs (0/O, 1/I/L). */
const INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const INVITE_TOKEN_PREFIX = "inv_";

function generateInviteTokenBody(): string {
  let out = "";
  for (let i = 0; i < INVITE_TOKEN_LEN; i++) {
    out += INVITE_ALPHABET[randomInt(0, INVITE_ALPHABET.length)]!;
  }
  return out;
}

export function formatInviteTag(tokenBody: string): string {
  return `${INVITE_TOKEN_PREFIX}${tokenBody}`;
}

export function parseInvitePayload(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const body = trimmed.startsWith(INVITE_TOKEN_PREFIX)
    ? trimmed.slice(INVITE_TOKEN_PREFIX.length)
    : trimmed;
  if (!/^[A-Z2-9]{6,12}$/.test(body)) return null;
  return body;
}

export async function buildInviteLink(tokenBody: string): Promise<string> {
  const username = await getTelegramBotUsername();
  const tag = formatInviteTag(tokenBody);
  if (!username) {
    return tag;
  }
  return `https://t.me/${username}?start=${encodeURIComponent(tag)}`;
}

export type InviteCopyPaste = {
  inviteTag: string;
  inviteLink: string;
  copyPasteMessage: string;
  expiresAt: string;
};

export function buildInviteCopyPaste(input: {
  firstName: string;
  lastName: string;
  email: string;
  inviteTag: string;
  inviteLink: string;
  expiresAt: Date;
  siteUrl?: string | null;
}): InviteCopyPaste {
  const name = deriveUserName(input.firstName, input.lastName);
  const expiresLabel = input.expiresAt.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const site = input.siteUrl?.replace(/\/$/, "") || "https://test.classmini580.blog";

  const copyPasteMessage = [
    `Salut ${input.firstName},`,
    "",
    `Tu es invité(e) sur Class Mini 5.80 (${name}).`,
    "",
    "1) Ouvre ce lien Telegram pour activer ton accès bot :",
    input.inviteLink,
    "",
    `2) Connexion web : ${site}/connexion`,
    `   Email : ${input.email}`,
    "   Onglet « Code Telegram » → code OTP reçu sur Telegram.",
    "",
    `Tag invitation (si le lien ne marche pas) : ${input.inviteTag}`,
    `Expire le ${expiresLabel}.`,
  ].join("\n");

  return {
    inviteTag: input.inviteTag,
    inviteLink: input.inviteLink,
    copyPasteMessage,
    expiresAt: input.expiresAt.toISOString(),
  };
}

export type CreateUserInviteResult =
  | { ok: true; user: UserDto; invite: InviteCopyPaste }
  | { ok: false; status: number; error: string };

export async function createUserInvite(input: {
  firstName: string;
  lastName: string;
  email: string;
  isAdmin?: boolean;
  createdById?: string;
}): Promise<CreateUserInviteResult> {
  const email = input.email.trim().toLowerCase();
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const name = deriveUserName(firstName, lastName);

  appLog("user-invite", "info", "create", { email, createdById: input.createdById });

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, status: true },
  });
  if (existing && existing.status !== UserStatus.ARCHIVED) {
    return { ok: false, status: 409, error: "Un compte existe déjà pour cet email" };
  }

  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  let tokenBody = generateInviteTokenBody();

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const user = await prisma.$transaction(async (tx) => {
        const row =
          existing && existing.status === UserStatus.ARCHIVED
            ? await tx.user.update({
                where: { id: existing.id },
                data: {
                  firstName,
                  lastName,
                  name,
                  telegramUserId: null,
                  passwordHash: OTP_ONLY_PASSWORD_HASH,
                  status: UserStatus.PENDING,
                  isAdmin: input.isAdmin ?? false,
                },
              })
            : await tx.user.create({
                data: {
                  email,
                  firstName,
                  lastName,
                  name,
                  passwordHash: OTP_ONLY_PASSWORD_HASH,
                  status: UserStatus.PENDING,
                  isAdmin: input.isAdmin ?? false,
                },
              });

        await tx.userInvite.deleteMany({ where: { userId: row.id } });

        await tx.userInvite.create({
          data: {
            token: tokenBody,
            userId: row.id,
            expiresAt,
            createdById: input.createdById ?? null,
          },
        });

        return row;
      });

      const inviteTag = formatInviteTag(tokenBody);
      const inviteLink = await buildInviteLink(tokenBody);
      const siteUrl = process.env.SITE_URL?.trim() || null;
      const invite = buildInviteCopyPaste({
        firstName,
        lastName,
        email,
        inviteTag,
        inviteLink,
        expiresAt,
        siteUrl,
      });

      const full = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
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

      appLog("user-invite", "info", "created", {
        userId: user.id,
        email,
        inviteTag,
        expiresAt: expiresAt.toISOString(),
      });

      return { ok: true, user: toUserDto(full), invite };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("Unique constraint") && attempt < 4) {
        tokenBody = generateInviteTokenBody();
        continue;
      }
      appLog("user-invite", "error", "create_failed", { email, error: message });
      return { ok: false, status: 500, error: "Impossible de créer l'invitation" };
    }
  }

  return { ok: false, status: 500, error: "Impossible de créer l'invitation" };
}

export type RedeemInviteResult =
  | { ok: true; welcomeText: string }
  | { ok: false; errorText: string };

export async function redeemUserInvite(input: {
  payload: string;
  telegramUserId: string;
  telegramLabel?: string;
}): Promise<RedeemInviteResult> {
  const tokenBody = parseInvitePayload(input.payload);
  if (!tokenBody) {
    return {
      ok: false,
      errorText:
        "Invitation invalide. Vérifie le lien ou le tag transmis par l'admin.",
    };
  }

  const telegramUserId = String(input.telegramUserId).trim();
  appLog("user-invite", "info", "redeem_attempt", {
    tokenBody,
    telegramUserId,
  });

  const existingActive = await prisma.user.findUnique({
    where: { telegramUserId },
    select: { status: true, email: true },
  });
  if (existingActive?.status === UserStatus.ACTIVE) {
    return {
      ok: true,
      welcomeText: [
        "✅ Ton compte Telegram est déjà actif.",
        existingActive.email ? `Email : ${existingActive.email}` : "",
        "",
        "Tu peux utiliser le bot ou te connecter au site (onglet Code Telegram).",
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  const invite = await prisma.userInvite.findUnique({
    where: { token: tokenBody },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          name: true,
          status: true,
        },
      },
    },
  });

  if (!invite) {
    return {
      ok: false,
      errorText: "Invitation introuvable. Demande un nouveau lien à l'admin.",
    };
  }

  if (invite.usedAt) {
    return {
      ok: false,
      errorText: "Cette invitation a déjà été utilisée.",
    };
  }

  if (invite.expiresAt.getTime() < Date.now()) {
    return {
      ok: false,
      errorText: "Invitation expirée. Demande un nouveau lien à l'admin.",
    };
  }

  if (invite.user.status !== UserStatus.PENDING) {
    return {
      ok: false,
      errorText: "Ce compte n'attend plus d'activation par invitation.",
    };
  }

  const conflict = await prisma.user.findFirst({
    where: {
      telegramUserId,
      id: { not: invite.userId },
      status: UserStatus.ACTIVE,
    },
    select: { id: true },
  });
  if (conflict) {
    return {
      ok: false,
      errorText:
        "Cet ID Telegram est déjà lié à un autre compte actif. Contacte un admin.",
    };
  }

  const greeting = invite.user.firstName || invite.user.name?.split(/\s+/)[0] || "Bonjour";
  const siteUrl = process.env.SITE_URL?.replace(/\/$/, "") || "https://test.classmini580.blog";

  await prisma.$transaction([
    prisma.user.update({
      where: { id: invite.userId },
      data: {
        telegramUserId,
        status: UserStatus.ACTIVE,
      },
    }),
    prisma.userInvite.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    }),
  ]);

  appLog("user-invite", "info", "redeemed", {
    userId: invite.userId,
    email: invite.user.email,
    telegramUserId,
  });

  return {
    ok: true,
    welcomeText: [
      `✅ Bienvenue ${greeting} — compte activé !`,
      "",
      `Email web : ${invite.user.email}`,
      `Site : ${siteUrl}/connexion`,
      "Connexion : onglet « Code Telegram » (code OTP reçu ici).",
      "",
      "Tu peux aussi discuter librement avec le bot pour gérer articles et médias.",
      input.telegramLabel ? `\n(${input.telegramLabel})` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}
