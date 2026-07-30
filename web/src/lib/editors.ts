import "server-only";

import { UserStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getEditorsAllowlist } from "@/lib/auth";

export type PlatformEditor = {
  id: string;
  email: string;
  name: string | null;
};

/** Platform editors = ACTIVE users in DB (allowlist env fallback when no status rows). */
export async function listPlatformEditors(): Promise<PlatformEditor[]> {
  const activeUsers = await prisma.user.findMany({
    where: { status: UserStatus.ACTIVE },
    select: { id: true, email: true, name: true },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });
  if (activeUsers.length > 0) return activeUsers;

  const allowlist = new Set(getEditorsAllowlist());
  if (allowlist.size === 0) return [];

  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });

  return users.filter((u) => allowlist.has(u.email.toLowerCase()));
}

/** Returns author id if it belongs to a platform editor; else null. */
export async function validatePlatformAuthorId(
  authorId: string | undefined | null
): Promise<string | null> {
  if (!authorId?.trim()) return null;

  const editors = await listPlatformEditors();
  const match = editors.find((e) => e.id === authorId);
  return match?.id ?? null;
}
