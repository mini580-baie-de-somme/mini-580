import { describe, expect, it } from "vitest";

import { stripMarkdownForTts } from "@/lib/telegram/speech/strip-markdown";
import {
  prepareTextForTts,
  resolveTelegramTtsAutoMode,
  shouldReplyWithVoice,
} from "@/lib/telegram/speech/tts";

describe("stripMarkdownForTts", () => {
  it("removes bold and links", () => {
    expect(stripMarkdownForTts("**Bonjour** [lien](https://x.test)")).toBe(
      "Bonjour lien"
    );
  });
});

describe("telegram TTS policy", () => {
  it("defaults to always", () => {
    delete process.env.TELEGRAM_TTS_AUTO;
    expect(resolveTelegramTtsAutoMode()).toBe("always");
    expect(shouldReplyWithVoice(false)).toBe(true);
  });

  it("voice mode only on inbound voice", () => {
    process.env.TELEGRAM_TTS_AUTO = "voice";
    expect(shouldReplyWithVoice(true)).toBe(true);
    expect(shouldReplyWithVoice(false)).toBe(false);
  });

  it("truncates long replies for TTS", () => {
    process.env.TELEGRAM_TTS_MAX_CHARS = "20";
    const out = prepareTextForTts("a".repeat(30));
    expect(out.length).toBeLessThanOrEqual(20);
  });
});
