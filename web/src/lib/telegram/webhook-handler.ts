import "server-only";

import { storeOriginAndVariants, type MediaVariantUrls } from "@/lib/media-variants";
import { isTelegramUserAllowed } from "@/lib/service-auth";
import {
  answerCallbackQuery,
  downloadTelegramFile,
  sendTelegramReply,
} from "@/lib/telegram/api";
import {
  resetTelegramAgent,
  runTelegramAgentTurn,
} from "@/lib/telegram/agent";
import {
  appendContent,
  getActiveSession,
  handleCallback,
  handleEditMessage,
  startSession,
  type BotReply,
} from "@/lib/telegram/publish-flow";

type TelegramUser = { id: number; username?: string; first_name?: string };
type TelegramChat = { id: number; type: string };
type TelegramPhotoSize = { file_id: string; width: number; height: number };
type TelegramMessage = {
  message_id: number;
  chat: TelegramChat;
  from?: TelegramUser;
  text?: string;
  caption?: string;
  photo?: TelegramPhotoSize[];
};
type TelegramCallbackQuery = {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
};
export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

async function storeTelegramPhoto(fileId: string): Promise<MediaVariantUrls> {
  const { buffer, filename, contentType } = await downloadTelegramFile(fileId);
  return storeOriginAndVariants(buffer, contentType, filename);
}

function largestPhoto(photos: TelegramPhotoSize[]): TelegramPhotoSize {
  return photos.reduce((best, p) =>
    p.width * p.height > best.width * best.height ? p : best
  );
}

async function ensureAllowed(from: TelegramUser | undefined): Promise<BotReply | null> {
  if (!from) return { text: "Utilisateur Telegram inconnu." };
  if (!isTelegramUserAllowed(from.id)) {
    const label = [from.first_name, from.username ? `@${from.username}` : null]
      .filter(Boolean)
      .join(" ");
    console.warn("telegram access denied", {
      userId: from.id,
      username: from.username,
      firstName: from.first_name,
    });
    return {
      text: `⛔ Compte non autorisé.\n\nTon ID Telegram : \`${from.id}\`${label ? `\n(${label})` : ""}\n\nTransmets cet ID à l'admin pour être ajouté à l'allowlist.`,
    };
  }
  return null;
}

const HELP = [
  "🚤 *Class Mini 5.80 — agent Telegram*",
  "",
  "Mode *agent* (défaut) — questions, recherche, CRUD articles/tags/jalons, médiathèque & photos. L'IA utilise les tools plateforme.",
  "",
  "`/nouveau` — parcours guidé de publication",
  "`/statut` — session guidée",
  "`/annuler` — quitter le parcours guidé",
  "`/reset` — réinitialiser la mémoire agent",
  "`/aide` — cette aide",
].join("\n");

export async function processTelegramUpdate(update: TelegramUpdate): Promise<void> {
  if (update.callback_query) {
    const cq = update.callback_query;
    const denied = await ensureAllowed(cq.from);
    const chatId = cq.message?.chat.id;
    if (denied && chatId) {
      await answerCallbackQuery(cq.id, "Non autorisé");
      await sendTelegramReply(chatId, denied);
      return;
    }
    if (!chatId || !cq.data) {
      await answerCallbackQuery(cq.id);
      return;
    }

    const session = await getActiveSession(String(cq.from.id), String(chatId));
    if (!session) {
      await answerCallbackQuery(cq.id, "Pas de session");
      await sendTelegramReply(chatId, {
        text: "Aucune session guidée. Discute librement, ou `/nouveau` pour publier pas-à-pas.",
      });
      return;
    }

    await answerCallbackQuery(cq.id);
    const reply = await handleCallback(session.id, cq.data);
    await sendTelegramReply(chatId, reply);
    return;
  }

  const message = update.message;
  if (!message?.from) return;

  const denied = await ensureAllowed(message.from);
  if (denied) {
    await sendTelegramReply(message.chat.id, denied);
    return;
  }

  const userId = String(message.from.id);
  const chatId = String(message.chat.id);
  const text = (message.text || message.caption || "").trim();

  if (/^\/(start|aide|help)\b/i.test(text)) {
    await sendTelegramReply(message.chat.id, { text: HELP });
    return;
  }

  if (/^\/nouveau\b/i.test(text)) {
    const reply = await startSession(userId, chatId);
    await sendTelegramReply(message.chat.id, reply);
    return;
  }

  if (/^\/annuler\b/i.test(text)) {
    const session = await getActiveSession(userId, chatId);
    if (session) {
      const reply = await handleCallback(session.id, "session:cancel");
      await sendTelegramReply(message.chat.id, reply);
    } else {
      await sendTelegramReply(message.chat.id, {
        text: "Rien à annuler (pas de parcours guidé).",
      });
    }
    return;
  }

  if (/^\/reset\b/i.test(text)) {
    await resetTelegramAgent(userId, chatId);
    await sendTelegramReply(message.chat.id, {
      text: "Mémoire agent réinitialisée.",
    });
    return;
  }

  if (/^\/statut\b/i.test(text)) {
    const session = await getActiveSession(userId, chatId);
    await sendTelegramReply(message.chat.id, {
      text: session
        ? `Parcours guidé actif — étape *${session.step}*${session.postId ? ` · post ${session.postId}` : ""}`
        : "Pas de parcours guidé. Mode agent libre.",
    });
    return;
  }

  if (/^\/traduire\b/i.test(text)) {
    const session = await getActiveSession(userId, chatId);
    if (!session?.postId) {
      await sendTelegramReply(message.chat.id, {
        text: "Pas de brouillon guidé. Demande à l'agent de traduire un post.",
      });
      return;
    }
    const reply = await handleCallback(session.id, "fr:approve");
    await sendTelegramReply(message.chat.id, reply);
    return;
  }

  const session = await getActiveSession(userId, chatId);
  if (session) {
    if (session.step === "AWAITING_CONTENT") {
      let mediaItem: MediaVariantUrls | undefined;
      if (message.photo?.length) {
        mediaItem = await storeTelegramPhoto(largestPhoto(message.photo).file_id);
      }
      const reply = await appendContent(session.id, {
        text: text || undefined,
        mediaItem,
        mediaUrl: mediaItem?.urlOrigin,
      });
      await sendTelegramReply(message.chat.id, reply, {
        replyToMessageId: message.message_id,
      });
      return;
    }

    if (text) {
      const reply = await handleEditMessage(session.id, text);
      await sendTelegramReply(message.chat.id, reply);
      return;
    }

    if (message.photo?.length) {
      await sendTelegramReply(message.chat.id, {
        text: "En parcours guidé, ajoute les photos au début ou passe en mode agent (`/annuler`).",
      });
    }
    return;
  }

  // Free-form agent
  await sendTelegramReply(message.chat.id, { text: "⏳ …" });

  const mediaUrls: string[] = [];
  if (message.photo?.length) {
    try {
      const stored = await storeTelegramPhoto(largestPhoto(message.photo).file_id);
      mediaUrls.push(stored.urlOrigin);
      if (stored.urlMoyenne) mediaUrls.push(stored.urlMoyenne);
    } catch (err) {
      await sendTelegramReply(message.chat.id, {
        text: `Échec upload photo: ${err instanceof Error ? err.message : String(err)}`,
      });
      return;
    }
  }

  const userMessage =
    text ||
    (mediaUrls.length
      ? "Voici une photo. Propose de la rattacher à un article existant ou de créer un brouillon."
      : "(message vide)");

  try {
    const answer = await runTelegramAgentTurn({
      telegramUserId: userId,
      telegramChatId: chatId,
      userMessage,
      mediaUrls,
    });
    await sendTelegramReply(message.chat.id, { text: answer });
  } catch (err) {
    await sendTelegramReply(message.chat.id, {
      text: `Erreur agent: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}
