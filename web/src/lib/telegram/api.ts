import "server-only";

import type { BotReply, InlineButton } from "@/lib/telegram/publish-flow";

export function getTelegramBotToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
}

type TelegramApiResult = { ok: boolean; result?: unknown; description?: string };

async function telegramCall(
  method: string,
  body: Record<string, unknown>
): Promise<TelegramApiResult> {
  const token = getTelegramBotToken();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");

  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as TelegramApiResult;
}

export async function sendTelegramVoice(
  chatId: string | number,
  audio: Buffer,
  options?: { replyToMessageId?: number; filename?: string }
) {
  const token = getTelegramBotToken();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");

  const form = new FormData();
  form.append("chat_id", String(chatId));
  const name = options?.filename ?? "reply.mp3";
  form.append(
    "voice",
    new Blob([new Uint8Array(audio)], { type: "audio/mpeg" }),
    name
  );
  if (options?.replyToMessageId) {
    form.append("reply_to_message_id", String(options.replyToMessageId));
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendVoice`, {
    method: "POST",
    body: form,
  });
  const result = (await res.json()) as TelegramApiResult;
  if (!result.ok) {
    throw new Error(result.description || "sendVoice failed");
  }
}

export async function sendTelegramReply(
  chatId: string | number,
  reply: BotReply,
  options?: { replyToMessageId?: number; inboundVoice?: boolean }
) {
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text: reply.text,
    parse_mode: "Markdown",
    disable_web_page_preview: reply.disableWebPagePreview ?? true,
  };
  if (options?.replyToMessageId) {
    payload.reply_to_message_id = options.replyToMessageId;
  }
  if (reply.buttons?.length) {
    payload.reply_markup = {
      inline_keyboard: reply.buttons.map((row: InlineButton[]) =>
        row.map((b) => ({ text: b.text, callback_data: b.callback_data }))
      ),
    };
  }

  try {
    const { shouldReplyWithVoice, synthesizeTelegramVoiceMp3 } = await import(
      "@/lib/telegram/speech/tts"
    );
    if (shouldReplyWithVoice(options?.inboundVoice ?? false)) {
      const mp3 = await synthesizeTelegramVoiceMp3(reply.text);
      await sendTelegramVoice(chatId, mp3, {
        replyToMessageId: options?.replyToMessageId,
      });
      return;
    }
  } catch (err) {
    console.warn("[telegram] TTS failed, falling back to text:", err);
  }

  const result = await telegramCall("sendMessage", payload);
  if (!result.ok) {
    // Retry without Markdown if parsing failed
    delete payload.parse_mode;
    payload.text = reply.text.replace(/\*/g, "");
    await telegramCall("sendMessage", payload);
  }
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  await telegramCall("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text: text ?? "",
  });
}

function contentTypeFromFilename(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".ogg") || lower.endsWith(".oga")) return "audio/ogg";
  if (lower.endsWith(".opus")) return "audio/opus";
  return "image/jpeg";
}

export async function downloadTelegramFile(
  fileId: string,
  kind: "photo" | "voice" | "audio" = "photo"
): Promise<{
  buffer: Buffer;
  filename: string;
  contentType: string;
  filePath: string;
}> {
  const token = getTelegramBotToken();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");

  const meta = await telegramCall("getFile", { file_id: fileId });
  if (!meta.ok || !meta.result || typeof meta.result !== "object") {
    throw new Error(meta.description || "getFile failed");
  }
  const filePath = (meta.result as { file_path?: string }).file_path;
  if (!filePath) throw new Error("Missing file_path");

  const res = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  let filename = filePath.split("/").pop() || "file.bin";
  if (kind === "voice" && !/\.(ogg|oga|opus)$/i.test(filename)) {
    filename = "voice.ogg";
  }
  if (kind === "audio" && !/\./.test(filename)) {
    filename = "audio.mp3";
  }
  const contentType = contentTypeFromFilename(filename);
  return { buffer, filename, contentType, filePath };
}
