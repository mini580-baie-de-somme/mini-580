import "server-only";

import { prisma } from "@/lib/db";
import { getEditorsAllowlist } from "@/lib/auth";

export type PlatformEditor = {
  id: string;
  email: string;
  name: string | null;
};

/** Platform editors = users in DB whose email is on EDITORS_ALLOWLIST. */
export async function listPlatformEditors(): Promise<PlatformEditor[]> {
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
