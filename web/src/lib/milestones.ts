import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";

export type MilestoneLocale = "fr" | "en";

/** Chronological, then alphabetical by title in the active language. */
export function milestoneOrderBy(
  locale: MilestoneLocale = "fr"
): Prisma.MilestoneOrderByWithRelationInput[] {
  return [
    { milestoneDate: "asc" },
    locale === "en" ? { titleEn: "asc" } : { titleFr: "asc" },
  ];
}

export function parseMilestoneLocale(
  value: string | null | undefined
): MilestoneLocale {
  return value === "en" ? "en" : "fr";
}

/** Slug base for milestones — always derived from the English title. */
export function milestoneSlugBase(titleEn: string): string {
  return titleEn.trim() || "milestone";
}

export async function uniqueMilestoneSlug(
  titleEn: string,
  excludeId?: string
): Promise<string> {
  const slug = slugify(milestoneSlugBase(titleEn)) || "milestone";
  let counter = 0;
  while (true) {
    const candidate = counter === 0 ? slug : `${slug}-${counter}`;
    const existing = await prisma.milestone.findUnique({ where: { slug: candidate } });
    if (!existing || existing.id === excludeId) return candidate;
    counter++;
  }
}

export function compareByDateThenTitle(
  a: { date: Date | string; title: string },
  b: { date: Date | string; title: string },
  locale: MilestoneLocale
): number {
  const da = new Date(a.date).getTime();
  const db = new Date(b.date).getTime();
  if (da !== db) return da - db;
  return a.title.localeCompare(b.title, locale === "en" ? "en" : "fr", {
    sensitivity: "base",
  });
}
