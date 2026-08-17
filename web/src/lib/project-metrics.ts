/** Project timeline anchor — override via NEXT_PUBLIC_PROJECT_START_DATE (ISO date). */
export const PROJECT_START_DATE =
  process.env.NEXT_PUBLIC_PROJECT_START_DATE ?? "2025-01-15";

/** Parse YYYY-MM-DD as local calendar date (avoids UTC midnight shift). */
export function parseLocalISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function startOfCalendarDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Inclusive calendar-day difference: same day → 0, next day → 1. */
export function calendarDaysBetween(start: Date, end: Date): number {
  const startDay = startOfCalendarDay(start);
  const endDay = startOfCalendarDay(end);
  const ms = endDay.getTime() - startDay.getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

/** @deprecated Use calendarDaysBetween — kept for callers migrating gradually. */
export function daysBetween(start: Date, end: Date): number {
  return calendarDaysBetween(start, end);
}

export function elapsedProjectDays(now = new Date()): number {
  return calendarDaysBetween(parseLocalISODate(PROJECT_START_DATE), now);
}

export function sumWorkDays(
  posts: Array<{ workDays: number | null | undefined }>
): number {
  return posts.reduce((acc, p) => acc + (p.workDays ?? 0), 0);
}
