import "server-only";

import { storeOriginAndVariants, type MediaVariantUrls } from "@/lib/media-variants";
import { isTelegramUserAllowed } from "@/lib/service-auth";
import {
  answerCallbackQuery,
  downloadTelegramFile,
  sendTelegramReply,
} from "@/lib/telegram/api";
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
    return {
      text: "⛔ Compte non autorisé. Demande l'ajout de ton Telegram ID à l'allowlist.",
    };
  }
  return null;
}

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
        text: "Aucune session active. Envoie /nouveau pour commencer.",
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
    await sendTelegramReply(message.chat.id, {
      text: [
        "🚤 *Class Mini 5.80 — publication Telegram*",
        "",
        "/nouveau — démarrer un post assisté IA",
        "/statut — session en cours",
        "/annuler — annuler la session",
        "",
        "Seuls les comptes Telegram autorisés (liste d'IDs) peuvent publier.",
      ].join("\n"),
    });
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
      await sendTelegramReply(message.chat.id, { text: "Rien à annuler." });
    }
    return;
  }

  if (/^\/statut\b/i.test(text)) {
    const session = await getActiveSession(userId, chatId);
    await sendTelegramReply(message.chat.id, {
      text: session
        ? `Session active — étape *${session.step}*${session.postId ? ` · post ${session.postId}` : ""}`
        : "Pas de session. /nouveau pour commencer.",
    });
    return;
  }

  if (/^\/traduire\b/i.test(text)) {
    const session = await getActiveSession(userId, chatId);
    if (!session?.postId) {
      await sendTelegramReply(message.chat.id, { text: "Aucun brouillon à traduire." });
      return;
    }
    const reply = await handleCallback(session.id, "fr:approve");
    await sendTelegramReply(message.chat.id, reply);
    return;
  }

  let session = await getActiveSession(userId, chatId);
  if (!session) {
    await sendTelegramReply(message.chat.id, {
      text: "Envoie /nouveau pour démarrer une publication assistée.",
    });
    return;
  }

  if (session.step === "AWAITING_CONTENT") {
    let mediaItem: Awaited<ReturnType<typeof storeTelegramPhoto>> | undefined;
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

  // Later steps: treat text as edit instructions
  if (text) {
    const reply = await handleEditMessage(session.id, text);
    await sendTelegramReply(message.chat.id, reply);
    return;
  }

  if (message.photo?.length) {
    await sendTelegramReply(message.chat.id, {
      text: "Les photos supplémentaires après la saisie initiale ne sont pas encore gérées — annule et recommence avec /nouveau, ou ajoute-les via l'éditeur web.",
    });
  }
}
