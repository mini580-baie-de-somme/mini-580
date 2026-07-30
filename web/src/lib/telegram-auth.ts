import "server-only";

import type { SessionUser } from "@/lib/auth";
import { UserStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { isTelegramUserAllowed } from "@/lib/service-auth";

export const TELEGRAM_USER_ID_HEADER = "X-Telegram-User-Id";

const sessionUserSelect = {
  id: true,
  email: true,
  name: true,
  status: true,
} as const;

function activeSessionUser(row: {
  id: string;
  email: string;
  name: string | null;
  status: UserStatus;
}): SessionUser | null {
  if (row.status !== UserStatus.ACTIVE) return null;
  return { id: row.id, email: row.email, name: row.name };
}

function serviceUserEmail(): string | null {
  return (
    process.env.TELEGRAM_SERVICE_USER_EMAIL?.trim().toLowerCase() ||
    process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase() ||
    null
  );
}

export function parseTelegramUserMap(): Map<string, string> {
  const raw = process.env.TELEGRAM_USER_MAP?.trim();
  const map = new Map<string, string>();
  if (!raw) return map;
  for (const part of raw.split(",")) {
    const entry = part.trim();
    if (!entry) continue;
    const colon = entry.indexOf(":");
    if (colon <= 0) continue;
    const telegramId = entry.slice(0, colon).trim();
    const email = entry.slice(colon + 1).trim().toLowerCase();
    if (telegramId && email) map.set(telegramId, email);
  }
  return map;
}

export async function resolveServiceEditorUser(): Promise<SessionUser | null> {
  const email = serviceUserEmail();
  if (!email) return null;
  const user = await prisma.user.findUnique({
    where: { email },
    select: sessionUserSelect,
  });
  return user ? activeSessionUser(user) : null;
}

/**
 * Map a Telegram user id to a platform User (author).
 * Lookup: DB telegramUserId → TELEGRAM_USER_MAP → TELEGRAM_SERVICE_USER_EMAIL.
 * Only maps when the id is allowed (DB ACTIVE or env allowlist); otherwise service user.
 */
export async function resolveTelegramAuthorUser(
  telegramUserId: string
): Promise<SessionUser | null> {
  const id = String(telegramUserId).trim();
  if (!id) return resolveServiceEditorUser();

  if (!(await isTelegramUserAllowed(id))) {
    return resolveServiceEditorUser();
  }

  const byTelegram = await prisma.user.findUnique({
    where: { telegramUserId: id },
    select: sessionUserSelect,
  });
  if (byTelegram) {
    const active = activeSessionUser(byTelegram);
    if (active) return active;
  }

  const mappedEmail = parseTelegramUserMap().get(id);
  if (mappedEmail) {
    const byEmail = await prisma.user.findUnique({
      where: { email: mappedEmail },
      select: sessionUserSelect,
    });
    if (byEmail) {
      const active = activeSessionUser(byEmail);
      if (active) return active;
    }
  }

  return resolveServiceEditorUser();
}
