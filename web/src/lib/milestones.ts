import type { Prisma } from "@/generated/prisma/client";

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
