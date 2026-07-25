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
  it("defaults to voice (text in → text out, voice in → voice out)", () => {
    delete process.env.TELEGRAM_TTS_AUTO;
    expect(resolveTelegramTtsAutoMode()).toBe("voice");
    expect(shouldReplyWithVoice(false)).toBe(false);
    expect(shouldReplyWithVoice(true)).toBe(true);
  });

  it("always mode sends TTS on every reply", () => {
    process.env.TELEGRAM_TTS_AUTO = "always";
    expect(shouldReplyWithVoice(false)).toBe(true);
    expect(shouldReplyWithVoice(true)).toBe(true);
  });

  it("truncates long replies for TTS", () => {
    process.env.TELEGRAM_TTS_MAX_CHARS = "20";
    const out = prepareTextForTts("a".repeat(30));
    expect(out.length).toBeLessThanOrEqual(20);
  });
});
