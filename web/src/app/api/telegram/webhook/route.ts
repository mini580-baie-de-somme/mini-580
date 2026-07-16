import { NextRequest, NextResponse } from "next/server";
import { getTelegramBotToken } from "@/lib/telegram/api";
import {
  processTelegramUpdate,
  type TelegramUpdate,
} from "@/lib/telegram/webhook-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Telegram Bot API webhook.
 * Set webhook: https://api.telegram.org/bot<TOKEN>/setWebhook?url=<SITE>/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>
 */
export async function POST(request: NextRequest) {
  if (!getTelegramBotToken()) {
    return NextResponse.json(
      { error: "TELEGRAM_BOT_TOKEN not configured" },
      { status: 503 }
    );
  }

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (secret) {
    const header = request.headers.get("x-telegram-bot-api-secret-token");
    if (header !== secret) {
      return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
    }
  }

  try {
    const update = (await request.json()) as TelegramUpdate;
    await processTelegramUpdate(update);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("telegram webhook failed", err);
    // Always 200 to Telegram to avoid retries storms on logic errors
    return NextResponse.json({ ok: false });
  }
}
