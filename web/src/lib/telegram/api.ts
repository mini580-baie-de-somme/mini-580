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

export async function sendTelegramReply(
  chatId: string | number,
  reply: BotReply,
  options?: { replyToMessageId?: number }
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

export async function downloadTelegramFile(fileId: string): Promise<{
  buffer: Buffer;
  filename: string;
  contentType: string;
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
  const filename = filePath.split("/").pop() || "photo.jpg";
  const contentType =
    filename.endsWith(".png")
      ? "image/png"
      : filename.endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";
  return { buffer, filename, contentType };
}
