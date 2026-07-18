import "server-only";

import {
  AI_TOOLS,
  resolveToolPath,
  type AiToolDef,
} from "@/lib/ai-tools";
import { getIngestApiKey } from "@/lib/service-auth";
import { TELEGRAM_USER_ID_HEADER } from "@/lib/telegram-auth";

export type ToolCallArgs = {
  /** Path params e.g. { id, imageId } */
  params?: Record<string, string>;
  /** Query string object for GET */
  query?: Record<string, string | number | boolean | undefined | null>;
  /** JSON body for POST/PUT/PATCH */
  body?: unknown;
};

function siteBaseUrl(): string {
  return (
    process.env.INTERNAL_API_BASE?.replace(/\/$/, "") ||
    process.env.SITE_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:3000"
  );
}

export function toolNameToKey(name: string): string {
  return name.replace(/\./g, "_");
}

export function findAiTool(nameOrKey: string): AiToolDef | undefined {
  const normalized = nameOrKey.replace(/_/g, ".");
  return (
    AI_TOOLS.find((t) => t.name === nameOrKey) ||
    AI_TOOLS.find((t) => t.name === normalized) ||
    AI_TOOLS.find((t) => toolNameToKey(t.name) === nameOrKey)
  );
}

/** Tools safe for the Telegram Cursor agent (Bearer). */
export function agentCallableTools(): AiToolDef[] {
  return AI_TOOLS.filter(
    (t) =>
      t.category !== "sync" &&
      (t.auth === "bearer_or_session" || t.auth === "public")
  );
}

function buildQuery(query?: ToolCallArgs["query"]): string {
  if (!query) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/**
 * Execute one AI_TOOLS entry against the local Next.js API with INGEST_API_KEY.
 */
export async function executeAiTool(
  nameOrKey: string,
  args: ToolCallArgs = {},
  options?: { telegramUserId?: string }
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const tool = findAiTool(nameOrKey);
  if (!tool) {
    return { ok: false, status: 404, data: { error: `Unknown tool: ${nameOrKey}` } };
  }

  if (tool.auth === "sync_otp") {
    return {
      ok: false,
      status: 403,
      data: { error: "sync_otp tools are not available to the Telegram agent" },
    };
  }

  const apiKey = getIngestApiKey();
  if (!apiKey && tool.auth === "bearer_or_session") {
    return {
      ok: false,
      status: 503,
      data: { error: "INGEST_API_KEY is not configured on the server" },
    };
  }

  let path: string;
  try {
    path = resolveToolPath(tool.path, args.params ?? {});
  } catch (err) {
    return {
      ok: false,
      status: 400,
      data: { error: err instanceof Error ? err.message : String(err) },
    };
  }

  const url = `${siteBaseUrl()}${path}${buildQuery(args.query)}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const telegramUserId = options?.telegramUserId?.trim();
  if (telegramUserId) headers[TELEGRAM_USER_ID_HEADER] = telegramUserId;

  const init: RequestInit = { method: tool.method, headers };
  if (tool.method !== "GET" && tool.method !== "DELETE" && args.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(args.body);
  } else if (
    (tool.method === "POST" || tool.method === "PUT" || tool.method === "PATCH") &&
    args.body === undefined
  ) {
    headers["Content-Type"] = "application/json";
    init.body = "{}";
  }

  try {
    const res = await fetch(url, init);
    const text = await res.text();
    let data: unknown = text;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text.slice(0, 2000);
    }
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return {
      ok: false,
      status: 502,
      data: {
        error: "Tool HTTP call failed",
        detail: err instanceof Error ? err.message : String(err),
        url,
      },
    };
  }
}

export function truncateToolResult(data: unknown, max = 8000): string {
  const raw = typeof data === "string" ? data : JSON.stringify(data, null, 0);
  if (raw.length <= max) return raw;
  return `${raw.slice(0, max)}…[truncated ${raw.length - max} chars]`;
}
