import "server-only";

import { downloadTelegramFile } from "@/lib/telegram/api";
import { transcribeTelegramAudio } from "@/lib/telegram/speech/transcribe";

type VoiceLike = { file_id: string };

export type InboundTelegramContent = {
  text: string;
  inboundVoice: boolean;
};

function guessVoiceFilename(filePath: string): string {
  const base = filePath.split("/").pop() || "voice.ogg";
  if (/\.(ogg|oga|opus|mp3|m4a|wav)$/i.test(base)) return base;
  return `${base}.ogg`;
}

async function transcribeFileId(fileId: string, kind: "voice" | "audio"): Promise<string> {
  const { buffer, filename, filePath } = await downloadTelegramFile(fileId, kind);
  const name = filename || guessVoiceFilename(filePath);
  return transcribeTelegramAudio(buffer, name);
}

export async function resolveInboundTelegramContent(input: {
  text?: string;
  caption?: string;
  voice?: VoiceLike;
  audio?: VoiceLike;
}): Promise<InboundTelegramContent> {
  const trimmed = (input.text || input.caption || "").trim();
  if (trimmed) {
    return { text: trimmed, inboundVoice: false };
  }

  if (input.voice?.file_id) {
    const transcript = await transcribeFileId(input.voice.file_id, "voice");
    return { text: transcript, inboundVoice: true };
  }

  if (input.audio?.file_id) {
    const transcript = await transcribeFileId(input.audio.file_id, "audio");
    return { text: transcript, inboundVoice: true };
  }

  return { text: "", inboundVoice: false };
}
