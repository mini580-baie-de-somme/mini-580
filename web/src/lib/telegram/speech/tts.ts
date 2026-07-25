import "server-only";

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { EdgeTTS } from "node-edge-tts";

import { stripMarkdownForTts } from "@/lib/telegram/speech/strip-markdown";

export type TelegramTtsAutoMode = "off" | "always" | "voice";

const DEFAULT_MAX_CHARS = 1500;

export function resolveTelegramTtsAutoMode(): TelegramTtsAutoMode {
  const raw = (process.env.TELEGRAM_TTS_AUTO ?? "voice").trim().toLowerCase();
  if (raw === "off" || raw === "false" || raw === "0") return "off";
  if (raw === "voice" || raw === "reply_voice") return "voice";
  return "always";
}

export function shouldReplyWithVoice(inboundVoice: boolean): boolean {
  const mode = resolveTelegramTtsAutoMode();
  if (mode === "off") return false;
  if (mode === "voice") return inboundVoice;
  return true;
}

function resolveTtsVoiceConfig() {
  return {
    voice: process.env.TELEGRAM_TTS_VOICE?.trim() || "fr-FR-DeniseNeural",
    lang: process.env.TELEGRAM_TTS_LANG?.trim() || "fr-FR",
    outputFormat:
      process.env.TELEGRAM_TTS_OUTPUT_FORMAT?.trim() ||
      "audio-24khz-48kbitrate-mono-mp3",
    timeout: Number(process.env.TELEGRAM_TTS_TIMEOUT_MS ?? "30000") || 30_000,
  };
}

export function prepareTextForTts(markdownReply: string): string {
  const plain = stripMarkdownForTts(markdownReply);
  const max = Number(process.env.TELEGRAM_TTS_MAX_CHARS ?? String(DEFAULT_MAX_CHARS));
  const limit = Number.isFinite(max) && max > 0 ? max : DEFAULT_MAX_CHARS;
  if (plain.length <= limit) return plain;
  return `${plain.slice(0, limit - 1)}…`;
}

export async function synthesizeTelegramVoiceMp3(text: string): Promise<Buffer> {
  const prepared = prepareTextForTts(text);
  if (!prepared) {
    throw new Error("Rien à synthétiser pour le vocal");
  }

  const cfg = resolveTtsVoiceConfig();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "tg-tts-"));
  const outPath = path.join(tmpDir, "reply.mp3");

  try {
    const tts = new EdgeTTS({
      voice: cfg.voice,
      lang: cfg.lang,
      outputFormat: cfg.outputFormat,
      saveSubtitles: false,
      timeout: cfg.timeout,
    });
    await tts.ttsPromise(prepared, outPath);
    return await fs.readFile(outPath);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
