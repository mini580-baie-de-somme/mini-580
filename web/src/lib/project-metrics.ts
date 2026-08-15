/** Project timeline anchor — override via NEXT_PUBLIC_PROJECT_START_DATE (ISO date). */
export const PROJECT_START_DATE =
  process.env.NEXT_PUBLIC_PROJECT_START_DATE ?? "2023-09-01";

export function daysBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export function elapsedProjectDays(now = new Date()): number {
  return daysBetween(new Date(PROJECT_START_DATE), now);
}

export function sumWorkDays(
  posts: Array<{ workDays: number | null | undefined }>
): number {
  return posts.reduce((acc, p) => acc + (p.workDays ?? 0), 0);
}
