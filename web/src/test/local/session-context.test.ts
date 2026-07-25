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

  it("memory hash is stable", () => {
    expect(hashMemoryBrief("a")).toBe(hashMemoryBrief("a"));
    expect(hashMemoryBrief("a")).not.toBe(hashMemoryBrief("b"));
  });
});
