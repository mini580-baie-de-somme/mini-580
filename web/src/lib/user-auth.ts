import "server-only";

import { NextRequest } from "next/server";
import type { SessionUser } from "@/lib/auth";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  extractBearerToken,
  isValidIngestApiKey,
} from "@/lib/service-auth";
import { TELEGRAM_USER_ID_HEADER } from "@/lib/telegram-auth";
import { UserStatus } from "@/generated/prisma/client";

const adminSelect = {
  id: true,
  email: true,
  name: true,
  isAdmin: true,
  status: true,
} as const;

function toSessionUser(row: {
  id: string;
  email: string;
  name: string | null;
}): SessionUser {
  return { id: row.id, email: row.email, name: row.name };
}

export async function isUserAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true, status: true },
  });
  return Boolean(user?.isAdmin && user.status === UserStatus.ACTIVE);
}

export function getTelegramAdminUserIds(): Set<string> {
  return new Set(
    (process.env.TELEGRAM_USER_ADMIN_IDS ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
  );
}

export async function isTelegramUserAdmin(
  telegramUserId: string
): Promise<boolean> {
  const id = String(telegramUserId).trim();
  if (!id) return false;

  const user = await prisma.user.findUnique({
    where: { telegramUserId: id },
    select: { isAdmin: true, status: true },
  });

  if (user) {
    if (user.status !== UserStatus.ACTIVE) return false;
    if (user.isAdmin) return true;
  }

  // Env bootstrap fallback when DB isAdmin was not backfilled yet (post-migration).
  return getTelegramAdminUserIds().has(id);
}

/** Session cookie or Bearer + X-Telegram-User-Id mapped to an ACTIVE admin. */
export async function getAdminFromRequest(
  request: NextRequest
): Promise<SessionUser | null> {
  const session = await getSession();
  if (session) {
    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: adminSelect,
    });
    if (user?.isAdmin && user.status === UserStatus.ACTIVE) {
      return toSessionUser(user);
    }
    return null;
  }

  if (!isValidIngestApiKey(extractBearerToken(request))) return null;

  const telegramUserId = request.headers.get(TELEGRAM_USER_ID_HEADER)?.trim();
  if (!telegramUserId) return null;

  const user = await prisma.user.findUnique({
    where: { telegramUserId },
    select: adminSelect,
  });
  if (user?.status === UserStatus.ACTIVE) {
    if (user.isAdmin || getTelegramAdminUserIds().has(telegramUserId)) {
      return toSessionUser(user);
    }
  }
  return null;
}

export async function requireAdminFromRequest(
  request: NextRequest
): Promise<SessionUser | "unauthorized" | "forbidden"> {
  const session = await getSession();
  const bearerOk = isValidIngestApiKey(extractBearerToken(request));

  if (!session && !bearerOk) return "unauthorized";

  const admin = await getAdminFromRequest(request);
  if (!admin) return "forbidden";
  return admin;
}
