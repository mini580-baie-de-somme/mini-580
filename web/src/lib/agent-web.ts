import "server-only";

import type { SDKCustomTool } from "@cursor/sdk";
import { appLog } from "@/lib/app-log";

const CHANNEL = "agent-web";

const MAX_FETCH_BYTES = 512_000;
const FETCH_TIMEOUT_MS = 20_000;
const MAX_SEARCH_RESULTS = 8;
const MAX_TEXT_CHARS = 12_000;

export function isTelegramAgentWebEnabled(): boolean {
  const v = process.env.TELEGRAM_AGENT_WEB_ENABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h === "0.0.0.0" ||
    h === "::1" ||
    h === "metadata.google.internal"
  ) {
    return true;
  }
  if (h.startsWith("127.")) return true;
  if (h.startsWith("10.")) return true;
  if (h.startsWith("192.168.")) return true;
  if (/^169\.254\./.test(h)) return true;
  const m = /^172\.(\d+)\./.exec(h);
  if (m) {
    const second = Number(m[1]);
    if (second >= 16 && second <= 31) return true;
  }
  if (h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) return true;
  return false;
}

export function assertPublicHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("URL invalide");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Seuls http et https sont autorisés");
  }
  if (url.username || url.password) {
    throw new Error("URL avec identifiants interdite");
  }
  if (isBlockedHost(url.hostname)) {
    throw new Error("Hôte local ou privé interdit");
  }
  return url;
}

function htmlToPlainText(html: string): string {
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  s = s.replace(/<[^>]+>/g, " ");
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  return s.replace(/\s+/g, " ").trim();
}

export async function agentWebFetch(urlInput: string): Promise<{
  ok: boolean;
  url: string;
  status?: number;
  contentType?: string;
  text: string;
  error?: string;
}> {
  let url: URL;
  try {
    url = assertPublicHttpUrl(urlInput);
  } catch (err) {
    return {
      ok: false,
      url: urlInput,
      text: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml,text/plain,application/json;q=0.9,*/*;q=0.8",
        "User-Agent":
          "ClassMini580Agent/1.0 (+https://classmini580.blog; research for authorized editors)",
      },
    });

    const contentType = res.headers.get("content-type") ?? undefined;
    const buf = Buffer.from(await res.arrayBuffer());
    const clipped =
      buf.length > MAX_FETCH_BYTES ? buf.subarray(0, MAX_FETCH_BYTES) : buf;
    let text = clipped.toString("utf-8");

    if (contentType?.includes("html") || text.trimStart().startsWith("<")) {
      text = htmlToPlainText(text);
    }

    if (text.length > MAX_TEXT_CHARS) {
      text = `${text.slice(0, MAX_TEXT_CHARS)}…[truncated]`;
    }

    appLog(CHANNEL, "debug", "web_fetch", {
      url: url.hostname,
      status: res.status,
      bytes: clipped.length,
    });

    return {
      ok: res.ok,
      url: res.url,
      status: res.status,
      contentType,
      text: text || "(contenu vide)",
    };
  } catch (err) {
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "Timeout fetch"
        : err instanceof Error
          ? err.message
          : String(err);
    appLog(CHANNEL, "warn", "web_fetch_failed", { url: url.hostname, error: message });
    return { ok: false, url: url.toString(), text: "", error: message };
  } finally {
    clearTimeout(timer);
  }
}

type SearchHit = { title: string; url: string; snippet: string };

function parseDdgHtml(html: string): SearchHit[] {
  const hits: SearchHit[] = [];
  const blockRe =
    /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>|<\/td>)/gi;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html)) && hits.length < MAX_SEARCH_RESULTS) {
    let href = m[1].replace(/&amp;/g, "&");
    if (href.startsWith("//")) href = `https:${href}`;
    const title = htmlToPlainText(m[2]);
    const snippet = m[3] ? htmlToPlainText(m[3]) : "";
    if (!href.startsWith("http")) continue;
    try {
      assertPublicHttpUrl(href);
    } catch {
      continue;
    }
    if (title) hits.push({ title, url: href, snippet });
  }
  return hits;
}

export async function agentWebSearch(query: string): Promise<{
  ok: boolean;
  query: string;
  results: SearchHit[];
  error?: string;
}> {
  const q = query.trim();
  if (!q) {
    return { ok: false, query: q, results: [], error: "Requête vide" };
  }

  const body = new URLSearchParams({ q });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch("https://html.duckduckgo.com/html/", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent":
          "ClassMini580Agent/1.0 (+https://classmini580.blog; research for authorized editors)",
      },
      body: body.toString(),
    });
    const html = await res.text();
    const results = parseDdgHtml(html);
    appLog(CHANNEL, "debug", "web_search", {
      q: q.slice(0, 80),
      count: results.length,
      status: res.status,
    });
    if (results.length === 0 && !res.ok) {
      return {
        ok: false,
        query: q,
        results: [],
        error: `Recherche HTTP ${res.status}`,
      };
    }
    return { ok: true, query: q, results };
  } catch (err) {
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "Timeout recherche"
        : err instanceof Error
          ? err.message
          : String(err);
    appLog(CHANNEL, "warn", "web_search_failed", { error: message });
    return { ok: false, query: q, results: [], error: message };
  } finally {
    clearTimeout(timer);
  }
}

export function buildAgentWebCustomTools(): Record<string, SDKCustomTool> {
  return {
    web_search: {
      description:
        "Recherche web (DuckDuckGo). Utiliser pour infos externes au site (météo, réglementation, actualités). Ne pas remplacer posts.list / gallery.list pour le contenu du blog.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Requête de recherche" },
        },
        required: ["query"],
      },
      execute: async (args) => {
        const query = typeof args.query === "string" ? args.query : "";
        const out = await agentWebSearch(query);
        const lines =
          out.results.length === 0
            ? ["Aucun résultat."]
            : out.results.map(
                (r, i) =>
                  `${i + 1}. ${r.title}\n   ${r.url}${r.snippet ? `\n   ${r.snippet}` : ""}`
              );
        const text = out.error
          ? `Erreur: ${out.error}`
          : `Recherche: ${out.query}\n\n${lines.join("\n\n")}`;
        return {
          content: [{ type: "text", text }],
          isError: !out.ok && out.results.length === 0,
        };
      },
    },
    web_fetch: {
      description:
        "Récupère le texte d'une page publique http(s). Usage: lire un article ou une doc externe. Interdit: réseau local / IP privées.",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL http(s) publique" },
        },
        required: ["url"],
      },
      execute: async (args) => {
        const url = typeof args.url === "string" ? args.url : "";
        const out = await agentWebFetch(url);
        if (out.error && !out.text) {
          return {
            content: [{ type: "text", text: `Erreur fetch: ${out.error}` }],
            isError: true,
          };
        }
        const header = `URL: ${out.url}${out.status != null ? ` (${out.status})` : ""}`;
        return {
          content: [{ type: "text", text: `${header}\n\n${out.text}` }],
          isError: !out.ok,
        };
      },
    },
  };
}

export const AGENT_WEB_SYSTEM_APPENDIX = `
Accès web (activé sur ce serveur) :
- web_search : recherche DuckDuckGo pour infos hors plateforme
- web_fetch : lecture texte d'une URL publique
Priorité : pour articles/médias/tags du site, utiliser les tools posts_*, media_*, gallery_list, etc.
`;
