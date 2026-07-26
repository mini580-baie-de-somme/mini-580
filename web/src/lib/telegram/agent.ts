import "server-only";

import { mkdirSync } from "fs";
import { Agent, type SDKCustomTool } from "@cursor/sdk";
import { prisma } from "@/lib/db";
import {
  agentCallableTools,
  executeAiTool,
  toolNameToKey,
  truncateToolResult,
  type ToolCallArgs,
} from "@/lib/ai-tools-runtime";
import { formatAgentMemoryBrief } from "@/lib/agent-memory";
import {
  SESSION_COMPACT_USER_PROMPT,
  buildBootstrapUserMessage,
  buildTurnUserMessage,
  hashMemoryBrief,
  shouldCompactSession,
} from "@/lib/telegram/session-context";
import {
  AGENT_WEB_SYSTEM_APPENDIX,
  buildAgentWebCustomTools,
  isTelegramAgentWebEnabled,
} from "@/lib/agent-web";

function getCursorApiKey(): string | null {
  return process.env.CURSOR_API_KEY?.trim() || null;
}

function getCursorModelId(): string {
  return process.env.CURSOR_MODEL?.trim() || "composer-2.5";
}

function getCursorCwd(): string {
  const cwd = process.env.CURSOR_CWD?.trim() || "/tmp/mini580-cursor";
  try {
    mkdirSync(cwd, { recursive: true });
  } catch {
    /* ignore */
  }
  return cwd;
}

function asStringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === undefined || v === null) continue;
    out[k] = String(v);
  }
  return out;
}

function idFromData(data: unknown): string | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const id = (data as Record<string, unknown>).id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/** Persist which post/photo the agent is currently working on. */
async function rememberActiveIds(
  threadId: string,
  toolName: string,
  params: Record<string, string> | undefined,
  data: unknown
): Promise<void> {
  const patch: { activePostId?: string | null; activeMediaId?: string | null } =
    {};

  if (toolName === "posts.create") {
    const postId = idFromData(data);
    if (postId) {
      patch.activePostId = postId;
      patch.activeMediaId = null;
    }
  } else if (
    toolName === "posts.get" ||
    toolName === "posts.update" ||
    toolName === "posts.publish" ||
    toolName === "posts.archive" ||
    toolName === "posts.delete"
  ) {
    if (params?.id) patch.activePostId = params.id;
  } else if (toolName === "photos.upload" || toolName === "media.attach" || toolName === "media.create") {
    if (params?.id) patch.activePostId = params.id;
    const mediaId = idFromData(data);
    if (mediaId) patch.activeMediaId = mediaId;
  } else if (
    toolName === "photos.patch" ||
    toolName === "photos.replace_file" ||
    toolName === "photos.delete" ||
    toolName === "media.update" ||
    toolName === "media.replace" ||
    toolName === "media.delete" ||
    toolName === "media.detach" ||
    toolName === "media.set_cover"
  ) {
    if (params?.id) patch.activePostId = params.id;
    const mid = params?.imageId || params?.mediaId;
    if (mid) {
      patch.activeMediaId =
        toolName === "photos.delete" ||
        toolName === "media.delete" ||
        toolName === "media.detach"
          ? null
          : mid;
    }
  } else if (
    toolName === "photos.list" ||
    toolName === "photos.reorder" ||
    toolName === "media.list_for_post" ||
    toolName === "media.reorder"
  ) {
    if (params?.id) patch.activePostId = params.id;
  } else if (toolName === "photos.replace_all") {
    if (params?.id) {
      patch.activePostId = params.id;
      patch.activeMediaId = null;
    }
  } else if (toolName === "media.get") {
    if (params?.id) patch.activeMediaId = params.id;
  }

  if (Object.keys(patch).length === 0) return;
  await prisma.telegramAgentThread.update({
    where: { id: threadId },
    data: patch,
  });
}

function buildPlatformCustomTools(
  threadId: string,
  telegramUserId: string
): Record<string, SDKCustomTool> {
  const tools: Record<string, SDKCustomTool> = {};

  for (const def of agentCallableTools()) {
    const key = toolNameToKey(def.name);
    tools[key] = {
      description: `${def.description} [${def.method} ${def.path}]`,
      inputSchema: {
        type: "object",
        properties: {
          params: {
            type: "object",
            description:
              "Path params required by the route (id, imageId, milestoneId, …)",
            additionalProperties: { type: "string" },
          },
          query: {
            type: "object",
            description: "Optional query string fields for GET filters",
            additionalProperties: true,
          },
          body: {
            description: "JSON body for POST/PUT/PATCH",
          },
        },
      },
      execute: async (args) => {
        const callArgs: ToolCallArgs = {
          params: asStringRecord(args.params),
          query: asStringRecord(args.query) as ToolCallArgs["query"],
          body: args.body,
        };
        const result = await executeAiTool(def.name, callArgs, {
          telegramUserId,
        });
        if (result.ok) {
          await rememberActiveIds(
            threadId,
            def.name,
            callArgs.params,
            result.data
          );
        }
        return {
          content: [
            {
              type: "text",
              text: truncateToolResult({
                tool: def.name,
                ok: result.ok,
                status: result.status,
                data: result.data,
              }),
            },
          ],
          isError: !result.ok,
        };
      },
    };
  }

  if (isTelegramAgentWebEnabled()) {
    Object.assign(tools, buildAgentWebCustomTools());
  }

  return tools;
}

function systemBriefForAgent(): string {
  return isTelegramAgentWebEnabled()
    ? `${SYSTEM_BRIEF.trim()}\n${AGENT_WEB_SYSTEM_APPENDIX.trim()}`
    : SYSTEM_BRIEF;
}

const SYSTEM_BRIEF = `Tu es l'assistant Class Mini 5.80 Baie de Somme sur Telegram.
Tu aides les comptes autorisés à :
- renseigner (coques #268/#269/#270, chantier, jalons, tags, thèmes)
- rechercher articles / médias (gallery.list, posts.list, media.list)
- créer / modifier / publier / archiver / supprimer : articles, médias, jalons, thèmes, tags
- gérer la médiathèque indépendante (IMAGE|DOCUMENT|VIDEO) : media.create, media.update, media.delete
- associer/détacher des médias à 0–N articles : media.attach, media.detach, media.reorder, media.set_cover
- partager des liens de prévisualisation (preview_create)
- mémoriser des règles et connaissances importantes entre sessions (agent_memory_*)

Règles :
- Utilise les tools HTTP (posts_*, media_*, tags_*, themes_*, milestones_*, agent_memory_*, gallery_list, translate, preview_create). photos_* restent disponibles (compat).
- Réponds en français, concis, adapté à Telegram (Markdown simple).
- Mémoire long terme : au bootstrap tu reçois les règles actives ; ensuite utilise agent_memory_list / create / update / delete. Ne jamais mentionner les id techniques à l'utilisateur (utilise le titre).
- Avant de publier ou supprimer, confirme clairement avec l'utilisateur.
- Créer un article : posts_create puis réutilise son id pour patchs et media.attach.
- Médias Telegram (/media/...) : media.create puis media.attach, ou photos_upload (compat).
- media.detach enlève le lien article ; media.delete supprime de la médiathèque (force=1 si lié).
- Ne invente pas d'IDs : utilise le contexte actif, ou liste d'abord.
- SITE_URL est dans le contexte ; aperçus /apercu/t/{token}.
`;

function formatActiveContext(thread: {
  activePostId: string | null;
  activeMediaId: string | null;
}): string {
  const lines = ["Contexte actif (à réutiliser sauf changement de sujet) :"];
  lines.push(
    thread.activePostId
      ? `- postId: ${thread.activePostId}`
      : "- postId: (aucun — crée un brouillon avec posts_create si besoin)"
  );
  lines.push(
    thread.activeMediaId
      ? `- mediaId: ${thread.activeMediaId}`
      : "- mediaId: (aucune)"
  );
  return lines.join("\n");
}

async function getOrCreateThread(telegramUserId: string, telegramChatId: string) {
  return prisma.telegramAgentThread.upsert({
    where: {
      telegramUserId_telegramChatId: { telegramUserId, telegramChatId },
    },
    create: { telegramUserId, telegramChatId },
    update: {},
  });
}

export async function resetTelegramAgent(
  telegramUserId: string,
  telegramChatId: string
): Promise<void> {
  await prisma.telegramAgentThread.deleteMany({
    where: { telegramUserId, telegramChatId },
  });
}

async function persistTurnUsage(
  threadId: string,
  usage: { inputTokens?: number } | undefined
): Promise<void> {
  const input = usage?.inputTokens;
  if (input == null || input <= 0) return;
  await prisma.telegramAgentThread.update({
    where: { id: threadId },
    data: { lastTurnInputTokens: input },
  });
}

const compactingThreadIds = new Set<string>();

async function compactTelegramSession(input: {
  threadId: string;
  cursorAgentId: string;
  apiKey: string;
  model: { id: string };
  cwd: string;
}): Promise<string | null> {
  try {
    await using agent = await Agent.resume(input.cursorAgentId, {
      apiKey: input.apiKey,
      model: input.model,
      local: { cwd: input.cwd },
    });
    const run = await agent.send(SESSION_COMPACT_USER_PROMPT);
    const result = await run.wait();
    const text =
      typeof result.result === "string" ? result.result.trim() : "";
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

async function executeAgentSend(input: {
  threadId: string;
  agentId: string | null;
  apiKey: string;
  model: { id: string };
  cwd: string;
  customTools: Record<string, SDKCustomTool>;
  message: string;
  telegramUserId: string;
  telegramChatId: string;
}): Promise<{ resultText: string; agentId: string; usageInput?: number }> {
  let agentId = input.agentId;
  let resultText = "";

  const agentOpts = {
    apiKey: input.apiKey,
    model: input.model,
    local: { cwd: input.cwd, customTools: input.customTools },
  };

  if (agentId) {
    try {
      await using agent = await Agent.resume(agentId, agentOpts);
      const run = await agent.send(input.message);
      const result = await run.wait();
      resultText = typeof result.result === "string" ? result.result : "";
      if (result.status === "error") {
        resultText =
          result.error?.message ||
          `Run en erreur (${result.id}). Réessaie ou envoie /reset.`;
      }
      return {
        resultText,
        agentId,
        usageInput: result.usage?.inputTokens,
      };
    } catch {
      agentId = null;
    }
  }

  await using agent = await Agent.create({
    ...agentOpts,
    name: `tg-${input.telegramUserId}`,
  });
  agentId = agent.agentId;
  await prisma.telegramAgentThread.update({
    where: { id: input.threadId },
    data: { cursorAgentId: agentId },
  });

  const run = await agent.send(input.message);
  const result = await run.wait();
  resultText = typeof result.result === "string" ? result.result : "";
  if (result.status === "error") {
    resultText =
      result.error?.message ||
      `Run en erreur (${result.id}). Réessaie ou envoie /reset.`;
  }

  return {
    resultText,
    agentId,
    usageInput: result.usage?.inputTokens,
  };
}

/**
 * Compacts the Cursor thread after a user-visible turn (post-reply), when the
 * completed turn reported input tokens ≥ compaction threshold.
 */
export async function maybeCompactTelegramSessionAfterTurn(input: {
  telegramUserId: string;
  telegramChatId: string;
}): Promise<void> {
  const thread = await prisma.telegramAgentThread.findUnique({
    where: {
      telegramUserId_telegramChatId: {
        telegramUserId: input.telegramUserId,
        telegramChatId: input.telegramChatId,
      },
    },
  });
  if (!thread?.cursorAgentId) return;
  if (!shouldCompactSession(thread.lastTurnInputTokens)) return;
  if (compactingThreadIds.has(thread.id)) return;

  const apiKey = getCursorApiKey();
  if (!apiKey) return;

  compactingThreadIds.add(thread.id);
  try {
    const summary = await compactTelegramSession({
      threadId: thread.id,
      cursorAgentId: thread.cursorAgentId,
      apiKey,
      model: { id: getCursorModelId() },
      cwd: getCursorCwd(),
    });
    await prisma.telegramAgentThread.update({
      where: { id: thread.id },
      data: {
        cursorAgentId: null,
        sessionSummary: summary ?? thread.sessionSummary,
        sessionCompactedAt: new Date(),
        lastTurnInputTokens: null,
      },
    });
  } finally {
    compactingThreadIds.delete(thread.id);
  }
}

/**
 * Run one conversational turn with Cursor agent + platform customTools.
 */
export async function runTelegramAgentTurn(input: {
  telegramUserId: string;
  telegramChatId: string;
  userMessage: string;
  mediaUrls?: string[];
}): Promise<string> {
  const apiKey = getCursorApiKey();
  if (!apiKey) {
    return "⚠️ CURSOR_API_KEY manquant — agent indisponible.";
  }
  if (!getIngestKeyPresent()) {
    return "⚠️ INGEST_API_KEY manquant — les tools API ne peuvent pas s'authentifier.";
  }

  const thread = await getOrCreateThread(
    input.telegramUserId,
    input.telegramChatId
  );
  const customTools = buildPlatformCustomTools(thread.id, input.telegramUserId);
  const cwd = getCursorCwd();
  const model = { id: getCursorModelId() };
  const memoryBrief = await formatAgentMemoryBrief();
  const memoryHash = hashMemoryBrief(memoryBrief);
  const activeContext = formatActiveContext(thread);
  const siteUrl = process.env.SITE_URL?.trim() || null;

  const memoryChanged = thread.memoryBriefHash !== memoryHash;
  const isBootstrap = !thread.cursorAgentId;

  const mediaBlock =
    input.mediaUrls && input.mediaUrls.length
      ? `\n\nMédias Telegram (URLs publiques):\n${input.mediaUrls.map((u, i) => `${i + 1}. ${u}`).join("\n")}`
      : "";

  const message = isBootstrap
    ? `${buildBootstrapUserMessage({
        systemBrief: systemBriefForAgent(),
        memoryBrief,
        activeContext,
        sessionSummary: thread.sessionSummary,
        siteUrl,
      })}\n\n---\nMessage utilisateur:\n${input.userMessage}${mediaBlock}`
    : buildTurnUserMessage({
        userMessage: input.userMessage,
        mediaUrls: input.mediaUrls,
        activeContext,
        memoryBrief: memoryChanged ? memoryBrief : null,
      });

  if (isBootstrap) {
    await prisma.telegramAgentThread.update({
      where: { id: thread.id },
      data: { memoryBriefHash: memoryHash },
    });
  } else if (memoryChanged) {
    await prisma.telegramAgentThread.update({
      where: { id: thread.id },
      data: { memoryBriefHash: memoryHash },
    });
  }

  let resultText = "";

  try {
    const out = await executeAgentSend({
      threadId: thread.id,
      agentId: thread.cursorAgentId,
      apiKey,
      model,
      cwd,
      customTools,
      message,
      telegramUserId: input.telegramUserId,
      telegramChatId: input.telegramChatId,
    });
    resultText = out.resultText;
    await persistTurnUsage(thread.id, { inputTokens: out.usageInput });
  } catch (err) {
    resultText = `Erreur agent: ${err instanceof Error ? err.message : String(err)}`;
  }

  return (
    resultText.trim() ||
    "_(pas de réponse texte — vérifie les tools ou reformule)_"
  );
}

function getIngestKeyPresent(): boolean {
  const key = process.env.INGEST_API_KEY?.trim();
  return Boolean(key && key.length >= 16);
}
