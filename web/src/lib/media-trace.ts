import "server-only";

import { randomUUID } from "node:crypto";
import { appLog, type LogLevel } from "./app-log";

export type MediaTraceContext = {
  traceId: string;
  mediaId?: string;
  postId?: string;
};

export function newMediaTraceId(prefix = "mt"): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

export function mediaTrace(
  ctx: MediaTraceContext,
  step: string,
  data?: Record<string, unknown>,
  level: LogLevel = "debug"
) {
  appLog("media-trace", level, step, {
    traceId: ctx.traceId,
    ...(ctx.mediaId ? { mediaId: ctx.mediaId } : {}),
    ...(ctx.postId ? { postId: ctx.postId } : {}),
    ...(data ?? {}),
  });
}

export class MediaRebakeError extends Error {
  constructor(
    message: string,
    public readonly step: string,
    public readonly traceId: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "MediaRebakeError";
  }
}

export function rebakeErrorDetail(err: unknown): string {
  if (err instanceof MediaRebakeError) return err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}

export function siteUrlForMediaFetch(): string | null {
  const raw =
    process.env.SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.INTERNAL_API_BASE?.trim();
  return raw ? raw.replace(/\/+$/, "") : null;
}
