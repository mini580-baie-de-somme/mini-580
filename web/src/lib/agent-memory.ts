import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export type AgentMemoryItemDto = {
  id: string;
  title: string;
  rule: string;
  createdAt: string;
  updatedAt: string;
};

export function activeAgentMemoryWhere(
  q?: string
): Prisma.AgentMemoryItemWhereInput {
  const base: Prisma.AgentMemoryItemWhereInput = { deletedAt: null };
  if (!q?.trim()) return base;
  const needle = q.trim();
  return {
    AND: [
      base,
      {
        OR: [
          { title: { contains: needle, mode: "insensitive" } },
          { rule: { contains: needle, mode: "insensitive" } },
        ],
      },
    ],
  };
}

export function toAgentMemoryDto(row: {
  id: string;
  title: string;
  rule: string;
  createdAt: Date;
  updatedAt: Date;
}): AgentMemoryItemDto {
  return {
    id: row.id,
    title: row.title,
    rule: row.rule,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listActiveAgentMemoryItems(options?: {
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  items: AgentMemoryItemDto[];
  total: number;
  totalAll: number;
  limit: number;
  offset: number;
}> {
  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 200);
  const offset = Math.max(options?.offset ?? 0, 0);
  const where = activeAgentMemoryWhere(options?.q);

  const [rows, total, totalAll] = await Promise.all([
    prisma.agentMemoryItem.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
      take: limit,
      skip: offset,
    }),
    prisma.agentMemoryItem.count({ where }),
    prisma.agentMemoryItem.count({ where: { deletedAt: null } }),
  ]);

  return {
    items: rows.map(toAgentMemoryDto),
    total,
    totalAll,
    limit,
    offset,
  };
}

/** Injected at Telegram agent bootstrap (and when memory hash changes mid-session). */
export async function formatAgentMemoryBrief(maxItems = 40): Promise<string> {
  const { items } = await listActiveAgentMemoryItems({ limit: maxItems });
  if (items.length === 0) {
    return "Mémoire agent (règles persistantes) : (vide — utilise agent_memory.create pour enregistrer une règle importante).";
  }
  const lines = [
    "Mémoire agent (règles persistantes — ne jamais citer les id techniques à l'utilisateur) :",
  ];
  for (const item of items) {
    lines.push(`- **${item.title}** : ${item.rule.replace(/\s+/g, " ").trim()}`);
  }
  return lines.join("\n");
}
