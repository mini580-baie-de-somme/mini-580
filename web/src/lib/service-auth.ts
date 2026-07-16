import "server-only";

import { timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";
import { getSession, type SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

/** Bearer token for OpenClaw / Telegram bot machine auth. */
export function getIngestApiKey(): string | null {
  const key = process.env.INGEST_API_KEY?.trim();
  return key && key.length >= 16 ? key : null;
}

export function isValidIngestApiKey(token: string | null | undefined): boolean {
  const expected = getIngestApiKey();
  if (!expected || !token) return false;
  return safeEqual(token, expected);
}

export function extractBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}

/**
 * Session cookie OR `Authorization: Bearer <INGEST_API_KEY>`.
 * Service auth resolves to the configured service editor user.
 */
export async function getEditorOrService(
  request: NextRequest
): Promise<SessionUser | null> {
  const session = await getSession();
  if (session) return session;

  if (!isValidIngestApiKey(extractBearerToken(request))) return null;

  const email =
    process.env.TELEGRAM_SERVICE_USER_EMAIL?.trim().toLowerCase() ||
    process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) return null;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true },
  });
  return user;
}

export function getTelegramAllowedUserIds(): Set<string> {
  return new Set(
    (process.env.TELEGRAM_ALLOWED_USER_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  );
}

export function isTelegramUserAllowed(userId: string | number): boolean {
  const allow = getTelegramAllowedUserIds();
  if (allow.size === 0) return false;
  return allow.has(String(userId));
}
