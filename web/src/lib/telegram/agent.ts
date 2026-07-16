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

function buildPlatformCustomTools(): Record<string, SDKCustomTool> {
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
        const result = await executeAiTool(def.name, callArgs);
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
- rechercher des articles / photos (gallery, posts.list, posts.get)
- créer / modifier / publier / archiver des contenus via les tools plateforme
- gérer la médiathèque et les images liées aux posts (upload, meta FR/EN, transforms, reorder, replace)
- partager des liens de prévisualisation (preview_create)

Règles :
- Utilise les tools HTTP de la plateforme (posts_*, photos_*, tags_*, themes_*, milestones_*, gallery_list, translate, preview_create, media_put).
- Réponds en français, concis, adapté à Telegram (Markdown simple).
- Avant de publier, confirme clairement avec l'utilisateur.
- Pour les photos Telegram déjà uploadées, tu recevras des URLs /media/... — rattache-les via photos_upload (JSON) ou photos_replace_all.
- Ne invente pas d'IDs : liste d'abord puis sélectionne.
- SITE_URL est dans le contexte ; les aperçus sont /apercu/t/{token}.
`;

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
  const customTools = buildPlatformCustomTools();
  const cwd = getCursorCwd();
  const model = { id: getCursorModelId() };

  const mediaBlock =
    input.mediaUrls && input.mediaUrls.length
      ? `\n\nMédias Telegram déjà stockés (URLs publiques):\n${input.mediaUrls.map((u, i) => `${i + 1}. ${u}`).join("\n")}`
      : "";

  const message = `${SYSTEM_BRIEF}\n\n---\nMessage utilisateur:\n${input.userMessage}${mediaBlock}`;

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
