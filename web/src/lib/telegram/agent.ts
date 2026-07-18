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

  return tools;
}

const SYSTEM_BRIEF = `Tu es l'assistant Class Mini 5.80 Baie de Somme sur Telegram.
Tu aides les comptes autorisés à :
- renseigner (coques #268/#269/#270, chantier, jalons, tags, thèmes)
- rechercher articles / médias (gallery.list, posts.list, media.list)
- créer / modifier / publier / archiver / supprimer : articles, médias, jalons, thèmes, tags
- gérer la médiathèque indépendante (IMAGE|DOCUMENT|VIDEO) : media.create, media.update, media.delete
- associer/détacher des médias à 0–N articles : media.attach, media.detach, media.reorder, media.set_cover
- partager des liens de prévisualisation (preview_create)

Règles :
- Utilise les tools HTTP (posts_*, media_*, tags_*, themes_*, milestones_*, gallery_list, translate, preview_create). photos_* restent disponibles (compat).
- Réponds en français, concis, adapté à Telegram (Markdown simple).
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

  const mediaBlock =
    input.mediaUrls && input.mediaUrls.length
      ? `\n\nMédias Telegram déjà stockés (URLs publiques):\n${input.mediaUrls.map((u, i) => `${i + 1}. ${u}`).join("\n")}`
      : "";

  const message = `${SYSTEM_BRIEF}\n\n${formatActiveContext(thread)}\n\n---\nMessage utilisateur:\n${input.userMessage}${mediaBlock}`;

  let agentId = thread.cursorAgentId;
  let resultText = "";

  try {
    if (agentId) {
      try {
        await using agent = await Agent.resume(agentId, {
          apiKey,
          model,
          local: { cwd, customTools },
        });
        const run = await agent.send(message);
        const result = await run.wait();
        resultText = typeof result.result === "string" ? result.result : "";
        if (result.status === "error") {
          resultText =
            result.error?.message ||
            `Run en erreur (${result.id}). Réessaie ou envoie /reset.`;
        }
      } catch {
        // Stale agent id — start fresh
        agentId = null;
      }
    }

    if (!agentId) {
      await using agent = await Agent.create({
        apiKey,
        model,
        name: `tg-${input.telegramUserId}`,
        local: { cwd, customTools },
      });
      agentId = agent.agentId;
      await prisma.telegramAgentThread.update({
        where: { id: thread.id },
        data: { cursorAgentId: agentId },
      });
      const run = await agent.send(message);
      const result = await run.wait();
      resultText = typeof result.result === "string" ? result.result : "";
      if (result.status === "error") {
        resultText =
          result.error?.message ||
          `Run en erreur (${result.id}). Réessaie ou envoie /reset.`;
      }
    }
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
