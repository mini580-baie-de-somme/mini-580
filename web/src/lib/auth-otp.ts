import "server-only";

import { createHash, randomInt } from "node:crypto";
import bcrypt from "bcrypt";
import { AuthOtpPurpose, UserStatus } from "@/generated/prisma/client";
import { appLog } from "@/lib/app-log";
import { prisma } from "@/lib/db";
import { sendTelegramPlainText } from "@/lib/telegram/api";
import {
  AUTH_INVALID_CREDENTIALS,
  AUTH_OTP_REQUEST_ACK,
  AUTH_OTP_VERIFY_FAILED,
} from "@/lib/auth-messages";

export const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RATE_LIMIT_COUNT = 3;
const OTP_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

import { OTP_ONLY_PASSWORD_HASH, isOtpOnlyPasswordHash } from "@/lib/auth-constants";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function generateOtpCode(): string {
  return String(randomInt(0, 10000)).padStart(4, "0");
}

async function hashOtpCode(code: string): Promise<string> {
  return bcrypt.hash(code, 10);
}

export async function verifyOtpCode(code: string, codeHash: string): Promise<boolean> {
  return bcrypt.compare(code, codeHash);
}

async function countRecentOtpRequests(email: string, purpose: AuthOtpPurpose): Promise<number> {
  const since = new Date(Date.now() - OTP_RATE_LIMIT_WINDOW_MS);
  return prisma.authOtpChallenge.count({
    where: { email, purpose, createdAt: { gte: since } },
  });
}

function purposeLabel(purpose: AuthOtpPurpose): string {
  return purpose === AuthOtpPurpose.PASSWORD_RESET
    ? "réinitialisation du mot de passe"
    : "connexion";
}

export type RequestOtpResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

export async function requestAuthOtp(input: {
  email: string;
  purpose: AuthOtpPurpose;
}): Promise<RequestOtpResult> {
  const email = normalizeEmail(input.email);
  appLog("auth-otp", "info", "request", { email, purpose: input.purpose });

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      status: true,
      telegramUserId: true,
      firstName: true,
      name: true,
    },
  });

  if (!user || user.status !== UserStatus.ACTIVE) {
    appLog("auth-otp", "warn", "request_rejected_inactive", { email });
    // Anti-enumeration: same ack whether or not the account exists.
    return { ok: true };
  }

  if (!user.telegramUserId) {
    appLog("auth-otp", "warn", "request_rejected_no_telegram", { email });
    return { ok: true };
  }

  const recent = await countRecentOtpRequests(email, input.purpose);
  if (recent >= OTP_RATE_LIMIT_COUNT) {
    appLog("auth-otp", "warn", "request_rate_limited", { email, recent });
    return {
      ok: false,
      status: 429,
      error: "Trop de demandes — réessayez dans quelques minutes",
    };
  }

  const code = generateOtpCode();
  const codeHash = await hashOtpCode(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await prisma.authOtpChallenge.create({
    data: {
      email,
      purpose: input.purpose,
      codeHash,
      expiresAt,
    },
  });

  const greeting = user.firstName || user.name?.split(/\s+/)[0] || "Bonjour";
  const text = `${greeting}, votre code Class Mini 5.80 (${purposeLabel(input.purpose)}) : ${code}\n\nValide 5 minutes. Ne le partagez pas.`;

  try {
    await sendTelegramPlainText(user.telegramUserId, text);
    appLog("auth-otp", "info", "sent", {
      email,
      purpose: input.purpose,
      telegramUserId: user.telegramUserId,
    });
  } catch (err) {
    appLog("auth-otp", "error", "send_failed", {
      email,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, status: 502, error: "Envoi Telegram impossible" };
  }

  return { ok: true };
}

export type VerifyOtpResult =
  | { ok: true; userId: string; email: string; name: string | null }
  | { ok: false; status: number; error: string };

export async function verifyAuthOtp(input: {
  email: string;
  code: string;
  purpose: AuthOtpPurpose;
}): Promise<VerifyOtpResult> {
  const email = normalizeEmail(input.email);
  const code = input.code.trim();
  appLog("auth-otp", "info", "verify_attempt", { email, purpose: input.purpose });

  if (!/^\d{4}$/.test(code)) {
    return { ok: false, status: 401, error: AUTH_OTP_VERIFY_FAILED };
  }

  const challenge = await prisma.authOtpChallenge.findFirst({
    where: {
      email,
      purpose: input.purpose,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!challenge) {
    appLog("auth-otp", "warn", "verify_no_challenge", { email });
    return { ok: false, status: 401, error: AUTH_OTP_VERIFY_FAILED };
  }

  if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
    appLog("auth-otp", "warn", "verify_max_attempts", { email });
    return { ok: false, status: 401, error: AUTH_OTP_VERIFY_FAILED };
  }

  const valid = await verifyOtpCode(code, challenge.codeHash);
  if (!valid) {
    await prisma.authOtpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    appLog("auth-otp", "warn", "verify_invalid_code", {
      email,
      attempts: challenge.attempts + 1,
    });
    return { ok: false, status: 401, error: AUTH_OTP_VERIFY_FAILED };
  }

  await prisma.webConnectLink.updateMany({
    where: { otpChallengeId: challenge.id },
    data: { usedAt: new Date(), otpChallengeId: null },
  });

  await prisma.authOtpChallenge.delete({ where: { id: challenge.id } });

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, status: true },
  });

  if (!user || user.status !== UserStatus.ACTIVE) {
    return { ok: false, status: 401, error: AUTH_OTP_VERIFY_FAILED };
  }

  appLog("auth-otp", "info", "verify_ok", { email, userId: user.id });
  return { ok: true, userId: user.id, email: user.email, name: user.name };
}

/** Test hook — deterministic OTP without Telegram. */
export async function createTestOtpChallenge(input: {
  email: string;
  purpose: AuthOtpPurpose;
  code: string;
}): Promise<void> {
  const email = normalizeEmail(input.email);
  const codeHash = await hashOtpCode(input.code);
  await prisma.authOtpChallenge.create({
    data: {
      email,
      purpose: input.purpose,
      codeHash,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });
}

export function otpFingerprint(code: string): string {
  return createHash("sha256").update(code).digest("hex").slice(0, 8);
}

/** Admin web-connect: OTP challenge without Telegram send or rate limit. */
export async function createAdminWebConnectOtpChallenge(input: {
  email: string;
}): Promise<
  | { ok: true; challengeId: string; code: string; expiresAt: Date }
  | { ok: false; status: number; error: string }
> {
  const email = normalizeEmail(input.email);
  appLog("auth-otp", "info", "admin_web_connect_create", { email });

  const user = await prisma.user.findUnique({
    where: { email },
    select: { status: true },
  });

  if (!user || user.status !== UserStatus.ACTIVE) {
    return { ok: false, status: 403, error: "Utilisateur inactif ou introuvable" };
  }

  const code = generateOtpCode();
  const codeHash = await hashOtpCode(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  const challenge = await prisma.authOtpChallenge.create({
    data: {
      email,
      purpose: AuthOtpPurpose.LOGIN,
      codeHash,
      expiresAt,
    },
  });

  return { ok: true, challengeId: challenge.id, code, expiresAt };
}

/** Consume OTP by challenge id (magic-link redeem — no user-entered code). */
export async function redeemOtpChallengeById(challengeId: string): Promise<VerifyOtpResult> {
  const challenge = await prisma.authOtpChallenge.findUnique({
    where: { id: challengeId },
  });

  if (!challenge) {
    return { ok: false, status: 401, error: "Code expiré ou invalide" };
  }

  if (challenge.expiresAt.getTime() < Date.now()) {
    return { ok: false, status: 401, error: "Code expiré ou invalide" };
  }

  if (challenge.purpose !== AuthOtpPurpose.LOGIN) {
    return { ok: false, status: 400, error: "Challenge invalide" };
  }

  const user = await prisma.user.findUnique({
    where: { email: challenge.email },
    select: { id: true, email: true, name: true, status: true },
  });

  if (!user || user.status !== UserStatus.ACTIVE) {
    return { ok: false, status: 401, error: AUTH_OTP_VERIFY_FAILED };
  }

  await prisma.webConnectLink.updateMany({
    where: { otpChallengeId: challenge.id },
    data: { usedAt: new Date(), otpChallengeId: null },
  });

  await prisma.authOtpChallenge.delete({ where: { id: challenge.id } });

  appLog("auth-otp", "info", "redeem_by_challenge_id", { email: user.email, userId: user.id });
  return { ok: true, userId: user.id, email: user.email, name: user.name };
}
