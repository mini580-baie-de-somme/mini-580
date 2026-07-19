/** Browser-side trace logs for photo editor save/rebake debugging. */

import { appLog, type LogLevel } from "./app-log";

export type PhotoEditorTraceContext = {
  traceId: string;
  postId?: string;
  mediaId?: string;
};

export function newPhotoEditorTraceId(): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `pe-${rand}`;
}

export function photoEditorTrace(
  ctx: PhotoEditorTraceContext,
  step: string,
  data?: Record<string, unknown>,
  level: LogLevel = "debug"
) {
  appLog("photo-editor-trace", level, step, {
    traceId: ctx.traceId,
    ...(ctx.postId ? { postId: ctx.postId } : {}),
    ...(ctx.mediaId ? { mediaId: ctx.mediaId } : {}),
    ...(data ?? {}),
  });
}

export async function readApiErrorBody(
  res: Response
): Promise<{ error?: unknown; traceId?: string; detail?: string; step?: string }> {
  try {
    return (await res.json()) as {
      error?: unknown;
      traceId?: string;
      detail?: string;
      step?: string;
    };
  } catch {
    return {};
  }
}
