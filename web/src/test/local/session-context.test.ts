import { describe, expect, it } from "vitest";
import {
  buildBootstrapUserMessage,
  buildTurnUserMessage,
  compactTriggerTokens,
  shouldCompactSession,
  hashMemoryBrief,
} from "@/lib/telegram/session-context";

describe("telegram session-context", () => {
  it("compact trigger at 70% of 128k", () => {
    expect(compactTriggerTokens(128_000)).toBe(89_600);
    expect(shouldCompactSession(89_600, 128_000)).toBe(true);
    expect(shouldCompactSession(89_599, 128_000)).toBe(false);
  });

  it("bootstrap includes system and memory once", () => {
    const msg = buildBootstrapUserMessage({
      systemBrief: "SYS",
      memoryBrief: "MEM",
      activeContext: "CTX",
    });
    expect(msg).toContain("SYS");
    expect(msg).toContain("MEM");
    expect(msg).toContain("CTX");
    expect(msg).toContain("Session initialisée");
  });

  it("turn message stays minimal", () => {
    const msg = buildTurnUserMessage({
      userMessage: "Salut",
      activeContext: "CTX",
    });
    expect(msg).not.toContain("Tu es l'assistant");
    expect(msg).toContain("Message utilisateur");
    expect(msg).toContain("Salut");
  });

  it("turn message includes inbound media block", () => {
    const msg = buildTurnUserMessage({
      userMessage: "Photo reçue",
      activeContext: "CTX",
      inboundMedia: [
        {
          mediaId: "med-1",
          urlOrigin: "/media/2026/08/x/origin.jpg",
          urlPicto: "/media/2026/08/x/picto.webp",
          urlPetite: "/media/2026/08/x/petite.webp",
          urlMoyenne: "/media/2026/08/x/moyenne.webp",
          urlGrande: "/media/2026/08/x/grande.webp",
        },
      ],
    });
    expect(msg).toContain("mediaId=med-1");
    expect(msg).toContain("NE PAS rappeler media.create");
    expect(msg).toContain("urlOrigin=/media/2026/08/x/origin.jpg");
  });

  it("compact trigger respects env overrides", () => {
    const prevMax = process.env.TELEGRAM_AGENT_CONTEXT_MAX_TOKENS;
    const prevRatio = process.env.TELEGRAM_AGENT_COMPACT_HIGH_RATIO;
    process.env.TELEGRAM_AGENT_CONTEXT_MAX_TOKENS = "100000";
    process.env.TELEGRAM_AGENT_COMPACT_HIGH_RATIO = "0.5";
    expect(compactTriggerTokens(100_000)).toBe(50_000);
    expect(shouldCompactSession(50_000, 100_000)).toBe(true);
    expect(shouldCompactSession(49_999, 100_000)).toBe(false);
    if (prevMax === undefined) delete process.env.TELEGRAM_AGENT_CONTEXT_MAX_TOKENS;
    else process.env.TELEGRAM_AGENT_CONTEXT_MAX_TOKENS = prevMax;
    if (prevRatio === undefined) delete process.env.TELEGRAM_AGENT_COMPACT_HIGH_RATIO;
    else process.env.TELEGRAM_AGENT_COMPACT_HIGH_RATIO = prevRatio;
  });

  it("memory hash is stable", () => {
    expect(hashMemoryBrief("a")).toBe(hashMemoryBrief("a"));
    expect(hashMemoryBrief("a")).not.toBe(hashMemoryBrief("b"));
  });
});
