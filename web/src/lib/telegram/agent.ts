import "server-only";

import { mkdirSync } from "fs";
import { Agent, type SDKCustomTool } from "@cursor/sdk";
import { appLog } from "@/lib/app-log";
import { prisma } from "@/lib/db";
import {
  agentCallableTools,
  executeAiTool,
  toolNameToKey,
  truncateToolResult,
  type ToolCallArgs,
} from "@/lib/ai-tools-runtime";
import { formatAgentMemoryBrief } from "@/lib/agent-memory";
import { isTelegramUserAdmin } from "@/lib/user-auth";
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
    toolName === "posts.delete" ||
    toolName === "posts.insert_media_group"
  ) {
    if (params?.id) patch.activePostId = params.id;
  } else if (
    toolName === "media_groups.create"
  ) {
    const groupId = idFromData(data);
    if (groupId) patch.activeMediaId = groupId;
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
  telegramUserId: string,
  isAdmin: boolean
): Record<string, SDKCustomTool> {
  const tools: Record<string, SDKCustomTool> = {};

  for (const def of agentCallableTools({ isAdmin })) {
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

const USERS_ADMIN_APPENDIX = `
Gestion des comptes (admin uniquement — tools users_* disponibles pour toi) :
- users_list : lister les utilisateurs (ACTIVE/INACTIVE/PENDING ; ?includeArchived=true pour tout voir)
- users_invite : créer une invitation Telegram (prénom, nom, email) → retourne copyPasteMessage à transmettre au nouvel utilisateur
- users_webConnect : générer un lien de connexion web (5 min) + code OTP pour un utilisateur ACTIVE existant → copyPasteMessage à transmettre
- users_create : prénom, nom, email, telegramUserId (si l'ID Telegram est déjà connu)
- users_update : modifier prénom, nom, email, telegramUserId
- users_deactivate : bloquer web + bot (INACTIVE)
- users_archive : retirer des listes actives (ARCHIVED)
- users_setAdmin : promouvoir ou rétrograder un admin (seul un admin peut le faire)
Pour users_invite et users_webConnect : affiche toujours copyPasteMessage tel quel pour que l'admin puisse copier-coller vers Telegram ou mail.
Ne jamais créer/modifier/désactiver un compte sans confirmation explicite de l'utilisateur.

Ton propre compte (tools account_* — aussi disponibles pour toi) :
- account_me, account_update, account_webConnect, account_otpLogin, account_otpPasswordReset, account_setPassword
Utilise account_* pour ton profil ; users_* pour gérer les autres comptes.
`;

const USERS_NON_ADMIN_NOTE = `
Ton compte (self-service uniquement — tools account_*) :
- account_me : consulter ton propre profil (email, nom, statut)
- account_update : modifier ton prénom, nom ou email
- account_webConnect : générer un lien de connexion web (5 min) + code OTP pour toi
- account_otpLogin : envoyer un code OTP connexion sur ton Telegram (pour /connexion)
- account_otpPasswordReset : envoyer un code OTP pour changer ton mot de passe web
- account_setPassword : définir un nouveau mot de passe avec le code OTP { code, newPassword }

Interdictions strictes :
- Tu n'as PAS les tools users_* (liste/création/gestion d'autres comptes).
- Ne liste jamais d'autres utilisateurs, même partiellement — pas de noms/emails d'éditeurs.
- Si on te demande de gérer un autre compte → refuse et oriente vers un admin plateforme.
Pour account_webConnect : affiche copyPasteMessage tel quel (lien + code).
`;

export function systemBriefForAgent(isAdmin: boolean): string {
  const roleBlock = isAdmin ? USERS_ADMIN_APPENDIX : USERS_NON_ADMIN_NOTE;
  const base = `${SYSTEM_BRIEF.trim()}${roleBlock}`;
  return isTelegramAgentWebEnabled()
    ? `${base}\n${AGENT_WEB_SYSTEM_APPENDIX.trim()}`
    : base;
}

const SYSTEM_BRIEF = `Tu es l'assistant Class Mini 5.80 Baie de Somme sur Telegram.
Tu aides les comptes autorisés à :
- renseigner (coques #268/#269/#270, chantier, jalons, tags, thèmes)
- rechercher articles / médias (gallery.list, posts.list, media.list)
- créer / modifier / publier / archiver / supprimer : articles, médias, jalons, thèmes, tags
- gérer la médiathèque indépendante (IMAGE|DOCUMENT|VIDEO) : media.create, media.update, media.delete
- associer/détacher des médias à 0–N articles : media.attach, media.detach, media.reorder, media.set_cover
- **groupes de médias inline** : media_groups_* (CRUD médiathèque, ordre membres) + posts_insert_media_group (insertion assistée dans le corps — jamais coller {{media-group:…}} à la main)
- partager des liens de prévisualisation (preview_create)
- mémoriser des règles et connaissances importantes entre sessions (agent_memory_*)

Règles :
- Utilise les tools HTTP (posts_*, media_*, media_groups_*, tags_*, themes_*, milestones_*, agent_memory_*, gallery_list, translate, preview_create). photos_* restent disponibles (compat).
- Réponds en français, concis, adapté à Telegram (Markdown simple).
- Mémoire long terme : au bootstrap tu reçois les règles actives ; ensuite utilise agent_memory_list / create / update / delete. Ne jamais mentionner les id techniques à l'utilisateur (utilise le titre).
- Avant de publier ou supprimer, confirme clairement avec l'utilisateur.
- Créer un article : posts_create puis réutilise son id pour patchs et media.attach.
- Médias Telegram (/media/...) : media.create puis media.attach, ou photos_upload (compat).
- media.detach enlève le lien article ; media.delete supprime de la médiathèque (force=1 si lié).
- **Groupes de médias** : workflow médiathèque → media_groups_create + add_media/reorder → posts_insert_media_group sur le brouillon actif. Les médias d'un groupe inline n'ont pas besoin de media.attach pour apparaître sur l'article public (manifeste unifié). Avant media_groups_delete : media_groups_references ou media_groups_get pour vérifier les articles liés (409 si encore référencé).
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
/** threadId → cursorAgentId snapshot while compaction runs on that agent */
const compactingAgentIds = new Map<string, string>();
const threadTurnChains = new Map<string, Promise<unknown>>();

function threadTurnKey(telegramUserId: string, telegramChatId: string): string {
  return `${telegramUserId}:${telegramChatId}`;
}

function isAgentUnderCompaction(threadId: string, agentId: string | null): boolean {
  if (!agentId) return false;
  return compactingAgentIds.get(threadId) === agentId;
}

/** Serialize user turns per Telegram thread (compaction runs outside this lock). */
async function withThreadTurnLock<T>(
  telegramUserId: string,
  telegramChatId: string,
  fn: () => Promise<T>
): Promise<T> {
  const key = threadTurnKey(telegramUserId, telegramChatId);
  const prev = threadTurnChains.get(key) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(fn);
  threadTurnChains.set(key, run);
  try {
    return await run;
  } finally {
    if (threadTurnChains.get(key) === run) {
      threadTurnChains.delete(key);
    }
  }
}

function getRunWaitTimeoutMs(): number {
  const raw = process.env.TELEGRAM_AGENT_RUN_TIMEOUT_MS?.trim();
  if (!raw) return 120_000;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 15_000) return 120_000;
  return n;
}

async function waitForAgentRun(
  run: { wait: () => Promise<{ status: string; result?: unknown; error?: { message?: string }; id?: string; usage?: { inputTokens?: number } }> },
  label: string
) {
  const timeoutMs = getRunWaitTimeoutMs();
  const result = await Promise.race([
    run.wait(),
    new Promise<never>((_, reject) => {
      setTimeout(
        () =>
          reject(
            new Error(
              `${label} timeout after ${Math.round(timeoutMs / 1000)}s — envoie /reset si ça se reproduit.`
            )
          ),
        timeoutMs
      );
    }),
  ]);
  return result;
}

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
    const result = await waitForAgentRun(run, "Compaction agent");
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

  if (isAgentUnderCompaction(input.threadId, agentId)) {
    appLog("telegram-agent", "info", "compaction_fork_bootstrap", {
      threadId: input.threadId,
      agentId,
    });
    agentId = null;
  }

  if (agentId) {
    try {
      await using agent = await Agent.resume(agentId, agentOpts);
      const run = await agent.send(input.message);
      const result = await waitForAgentRun(run, "Agent resume");
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
    } catch (err) {
      appLog("telegram-agent", "warn", "agent_resume_failed", {
        threadId: input.threadId,
        agentId,
        error: err instanceof Error ? err.message : String(err),
      });
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
  const result = await waitForAgentRun(run, "Agent create");
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
 * Non-blocking: never queued behind the next user turn; concurrent turns fork
 * a fresh Cursor agent while compaction reads the old snapshot.
 */
export async function maybeCompactTelegramSessionAfterTurn(input: {
  telegramUserId: string;
  telegramChatId: string;
}): Promise<void> {
  return maybeCompactTelegramSessionAfterTurnUnlocked(input);
}

async function maybeCompactTelegramSessionAfterTurnUnlocked(input: {
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

  const agentIdAtStart = thread.cursorAgentId;
  compactingThreadIds.add(thread.id);
  compactingAgentIds.set(thread.id, agentIdAtStart);

  appLog("telegram-agent", "info", "compaction_start", {
    threadId: thread.id,
    agentId: agentIdAtStart,
    lastTurnInputTokens: thread.lastTurnInputTokens,
  });

  try {
    const summary = await compactTelegramSession({
      threadId: thread.id,
      cursorAgentId: agentIdAtStart,
      apiKey,
      model: { id: getCursorModelId() },
      cwd: getCursorCwd(),
    });

    if (!summary) {
      appLog("telegram-agent", "warn", "compaction_failed", {
        threadId: thread.id,
        agentId: agentIdAtStart,
      });
      return;
    }

    await prisma.telegramAgentThread.update({
      where: { id: thread.id },
      data: {
        sessionSummary: summary,
        sessionCompactedAt: new Date(),
        lastTurnInputTokens: null,
      },
    });

    const reset = await prisma.telegramAgentThread.updateMany({
      where: { id: thread.id, cursorAgentId: agentIdAtStart },
      data: { cursorAgentId: null },
    });

    appLog("telegram-agent", "info", "compaction_done", {
      threadId: thread.id,
      agentId: agentIdAtStart,
      agentReset: reset.count > 0,
      summaryChars: summary.length,
    });
  } finally {
    compactingThreadIds.delete(thread.id);
    compactingAgentIds.delete(thread.id);
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
  return withThreadTurnLock(input.telegramUserId, input.telegramChatId, () =>
    runTelegramAgentTurnUnlocked(input)
  );
}

async function runTelegramAgentTurnUnlocked(input: {
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

  appLog("telegram-agent", "info", "turn_start", {
    telegramUserId: input.telegramUserId,
    telegramChatId: input.telegramChatId,
    messageChars: input.userMessage.length,
    mediaCount: input.mediaUrls?.length ?? 0,
  });

  const thread = await getOrCreateThread(
    input.telegramUserId,
    input.telegramChatId
  );
  const isAdmin = await isTelegramUserAdmin(input.telegramUserId);
  const customTools = buildPlatformCustomTools(
    thread.id,
    input.telegramUserId,
    isAdmin
  );
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
        systemBrief: systemBriefForAgent(isAdmin),
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
    appLog("telegram-agent", "error", "turn_failed", {
      telegramUserId: input.telegramUserId,
      threadId: thread.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const reply =
    resultText.trim() ||
    "_(pas de réponse texte — vérifie les tools ou reformule)_";

  appLog("telegram-agent", "info", "turn_done", {
    telegramUserId: input.telegramUserId,
    threadId: thread.id,
    replyChars: reply.length,
  });

  return reply;
}

function getIngestKeyPresent(): boolean {
  const key = process.env.INGEST_API_KEY?.trim();
  return Boolean(key && key.length >= 16);
}
