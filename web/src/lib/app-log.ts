/** Structured logging with level filtering — safe for client + server. */

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error";

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
};

function parseLogLevel(raw: string | undefined): LogLevel | null {
  if (!raw?.trim()) return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized in LOG_LEVEL_ORDER) return normalized as LogLevel;
  return null;
}

function isProdEnvironment(): boolean {
  const syncEnv = (process.env.SYNC_ENV ?? "").toLowerCase();
  if (syncEnv === "prod") return true;
  const siteUrl =
    process.env.SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "";
  if (siteUrl && !/test/i.test(siteUrl)) return true;
  return false;
}

export function resolveLogLevel(): LogLevel {
  const fromEnv =
    parseLogLevel(process.env.LOG_LEVEL) ??
    parseLogLevel(process.env.NEXT_PUBLIC_LOG_LEVEL);
  if (fromEnv) return fromEnv;
  return isProdEnvironment() ? "warn" : "debug";
}

let resolvedLevel: LogLevel | null = null;

/** Test hook — clears cached resolved level. */
export function resetLogLevelCache(): void {
  resolvedLevel = null;
}

export function shouldLog(level: LogLevel): boolean {
  if (resolvedLevel === null) resolvedLevel = resolveLogLevel();
  return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[resolvedLevel];
}

export function appLog(
  channel: string,
  level: LogLevel,
  message: string,
  data?: Record<string, unknown>
): void {
  if (!shouldLog(level)) return;
  const payload = {
    channel,
    level,
    message,
    ...(data ?? {}),
  };
  const line = JSON.stringify(payload);
  switch (level) {
    case "error":
      console.error(`[${channel}]`, line);
      break;
    case "warn":
      console.warn(`[${channel}]`, line);
      break;
    default:
      console.info(`[${channel}]`, line);
  }
}
