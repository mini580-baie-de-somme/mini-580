import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { prisma } from "@/lib/db";
import { SESSION_COMPACT_USER_PROMPT } from "@/lib/telegram/session-context";
import {
  installCursorAgentMock,
  isCompactPrompt,
  makeMockAgent,
  resetCursorAgentMockState,
} from "../helpers/cursor-agent-mock";

const TG_USER = "990001001";
const TG_CHAT = "990001001";

const cursorMock = installCursorAgentMock();

vi.mock("@cursor/sdk", () => ({
  Agent: {
    create: (...args: unknown[]) => cursorMock.create(...args),
    resume: (...args: unknown[]) => cursorMock.resume(...args),
  },
}));

vi.mock("@/lib/user-auth", () => ({
  isTelegramUserAdmin: vi.fn(async () => true),
}));

vi.mock("@/lib/agent-memory", () => ({
  formatAgentMemoryBrief: vi.fn(async () => "MEM"),
}));

vi.mock("@/lib/ai-tools-runtime", () => ({
  agentCallableTools: vi.fn(() => []),
  executeAiTool: vi.fn(),
  toolNameToKey: vi.fn((n: string) => n.replace(/\./g, "_")),
  truncateToolResult: vi.fn(({ data }: { data: unknown }) =>
    JSON.stringify(data)
  ),
}));

vi.mock("@/lib/agent-web", () => ({
  AGENT_WEB_SYSTEM_APPENDIX: "",
  buildAgentWebCustomTools: vi.fn(() => ({})),
  isTelegramAgentWebEnabled: vi.fn(() => false),
}));

async function loadAgent() {
  vi.resetModules();
  return import("@/lib/telegram/agent");
}

async function seedThread(input: {
  cursorAgentId?: string | null;
  lastTurnInputTokens?: number | null;
  sessionSummary?: string | null;
}) {
  await prisma.telegramAgentThread.deleteMany({
    where: { telegramUserId: TG_USER, telegramChatId: TG_CHAT },
  });
  return prisma.telegramAgentThread.create({
    data: {
      telegramUserId: TG_USER,
      telegramChatId: TG_CHAT,
      cursorAgentId: input.cursorAgentId ?? null,
      lastTurnInputTokens: input.lastTurnInputTokens ?? null,
      sessionSummary: input.sessionSummary ?? null,
    },
  });
}

describe("telegram agent compaction — non-regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCursorAgentMockState();
    cursorMock.resetDefaults();
    process.env.CURSOR_API_KEY = "test-cursor-key";
    process.env.INGEST_API_KEY = "test-ingest-key-16chars";
    process.env.TELEGRAM_AGENT_RUN_TIMEOUT_MS = "8000";
  });

  afterEach(async () => {
    await prisma.telegramAgentThread.deleteMany({
      where: { telegramUserId: TG_USER, telegramChatId: TG_CHAT },
    });
  });

  it("skips compaction when lastTurnInputTokens is below threshold", async () => {
    await seedThread({
      cursorAgentId: "agent-low",
      lastTurnInputTokens: 10_000,
    });
    const { maybeCompactTelegramSessionAfterTurn } = await loadAgent();

    await maybeCompactTelegramSessionAfterTurn({
      telegramUserId: TG_USER,
      telegramChatId: TG_CHAT,
    });

    expect(cursorMock.resume).not.toHaveBeenCalled();
  });

  it("stores sessionSummary and clears cursorAgentId after successful compaction", async () => {
    const thread = await seedThread({
      cursorAgentId: "agent-compact-1",
      lastTurnInputTokens: 95_000,
    });
    cursorMock.resume.mockImplementationOnce(async (agentId: string) => {
      const agent = makeMockAgent({
        agentId,
        onSend: (message) =>
          isCompactPrompt(message)
            ? { status: "completed", result: "Synthèse session test.", id: "c1" }
            : { status: "completed", result: "unexpected", id: "x" },
      });
      return {
        agentId: agent.agentId,
        send: agent.send,
        [Symbol.asyncDispose]: agent.dispose,
      };
    });

    const { maybeCompactTelegramSessionAfterTurn } = await loadAgent();
    await maybeCompactTelegramSessionAfterTurn({
      telegramUserId: TG_USER,
      telegramChatId: TG_CHAT,
    });

    const updated = await prisma.telegramAgentThread.findUnique({
      where: { id: thread.id },
    });
    expect(updated?.sessionSummary).toContain("Synthèse session test");
    expect(updated?.cursorAgentId).toBeNull();
    expect(updated?.lastTurnInputTokens).toBeNull();
    expect(updated?.sessionCompactedAt).toBeTruthy();
    expect(cursorMock.resume).toHaveBeenCalledWith(
      "agent-compact-1",
      expect.any(Object)
    );
  });

  it("does not block the next user turn while compaction is in flight", async () => {
    let releaseCompaction!: () => void;
    const compactionGate = new Promise<void>((resolve) => {
      releaseCompaction = resolve;
    });

    await seedThread({
      cursorAgentId: "agent-slow",
      lastTurnInputTokens: 96_000,
    });

    cursorMock.resume.mockImplementation(async (agentId: string) => {
      const agent = makeMockAgent({
        agentId,
        onSend: async (message) => {
          if (isCompactPrompt(message)) {
            await compactionGate;
            return {
              status: "completed",
              result: "Synthèse lente.",
              id: "slow-compact",
            };
          }
          return {
            status: "completed",
            result: "should-not-happen",
            usage: { inputTokens: 2000 },
            id: "turn-during",
          };
        },
      });
      return {
        agentId: agent.agentId,
        send: agent.send,
        [Symbol.asyncDispose]: agent.dispose,
      };
    });

    cursorMock.create.mockImplementationOnce(async () => {
      const agent = makeMockAgent({
        agentId: "agent-fork",
        onSend: () => ({
          status: "completed",
          result: "fork-reply",
          usage: { inputTokens: 1500 },
          id: "fork-run",
        }),
      });
      return {
        agentId: agent.agentId,
        send: agent.send,
        [Symbol.asyncDispose]: agent.dispose,
      };
    });

    const { maybeCompactTelegramSessionAfterTurn, runTelegramAgentTurn } =
      await loadAgent();

    const compactPromise = maybeCompactTelegramSessionAfterTurn({
      telegramUserId: TG_USER,
      telegramChatId: TG_CHAT,
    });
    await vi.waitFor(
      () => {
        expect(cursorMock.resume.mock.calls.length).toBeGreaterThan(0);
      },
      { timeout: 3000 }
    );

    const turnStarted = Date.now();
    const reply = await runTelegramAgentTurn({
      telegramUserId: TG_USER,
      telegramChatId: TG_CHAT,
      userMessage: "Question pendant compaction",
    });
    const turnMs = Date.now() - turnStarted;

    expect(reply).toContain("fork-reply");
    expect(turnMs).toBeLessThan(3000);
    expect(cursorMock.create).toHaveBeenCalled();

    releaseCompaction();
    await compactPromise;
  });

  it("preserves forked cursorAgentId when compaction finishes after a concurrent turn", async () => {
    let releaseCompaction!: () => void;
    const compactionGate = new Promise<void>((resolve) => {
      releaseCompaction = resolve;
    });

    const thread = await seedThread({
      cursorAgentId: "agent-original",
      lastTurnInputTokens: 97_000,
    });

    cursorMock.resume.mockImplementation(async (agentId: string) => {
      const agent = makeMockAgent({
        agentId,
        onSend: async (message) => {
          if (isCompactPrompt(message)) {
            await compactionGate;
            return {
              status: "completed",
              result: "Synthèse post-fork.",
              id: "compact-after-fork",
            };
          }
          return {
            status: "completed",
            result: "should-not-resume-during-compaction",
            id: "bad-resume",
          };
        },
      });
      return {
        agentId: agent.agentId,
        send: agent.send,
        [Symbol.asyncDispose]: agent.dispose,
      };
    });

    cursorMock.create.mockImplementationOnce(async () => {
      const agent = makeMockAgent({
        agentId: "agent-fork-persist",
        onSend: () => ({
          status: "completed",
          result: "fork-persist",
          usage: { inputTokens: 1200 },
          id: "fork-persist-run",
        }),
      });
      return {
        agentId: agent.agentId,
        send: agent.send,
        [Symbol.asyncDispose]: agent.dispose,
      };
    });

    const { maybeCompactTelegramSessionAfterTurn, runTelegramAgentTurn } =
      await loadAgent();

    const compactPromise = maybeCompactTelegramSessionAfterTurn({
      telegramUserId: TG_USER,
      telegramChatId: TG_CHAT,
    });
    await vi.waitFor(
      () => {
        expect(cursorMock.resume.mock.calls.length).toBeGreaterThan(0);
      },
      { timeout: 3000 }
    );

    await runTelegramAgentTurn({
      telegramUserId: TG_USER,
      telegramChatId: TG_CHAT,
      userMessage: "Fork test",
    });

    releaseCompaction();
    await compactPromise;

    const updated = await prisma.telegramAgentThread.findUnique({
      where: { id: thread.id },
    });
    expect(updated?.sessionSummary).toContain("Synthèse post-fork");
    expect(updated?.cursorAgentId).toBe("agent-fork-persist");
  });

  it("leaves cursorAgentId unchanged when compaction returns empty summary", async () => {
    const thread = await seedThread({
      cursorAgentId: "agent-fail",
      lastTurnInputTokens: 98_000,
      sessionSummary: "Previous summary",
    });

    cursorMock.resume.mockImplementationOnce(async (agentId: string) => {
      const agent = makeMockAgent({
        agentId,
        onSend: () => ({
          status: "completed",
          result: "   ",
          id: "empty-compact",
        }),
      });
      return {
        agentId: agent.agentId,
        send: agent.send,
        [Symbol.asyncDispose]: agent.dispose,
      };
    });

    const { maybeCompactTelegramSessionAfterTurn } = await loadAgent();
    await maybeCompactTelegramSessionAfterTurn({
      telegramUserId: TG_USER,
      telegramChatId: TG_CHAT,
    });

    const updated = await prisma.telegramAgentThread.findUnique({
      where: { id: thread.id },
    });
    expect(updated?.cursorAgentId).toBe("agent-fail");
    expect(updated?.sessionSummary).toBe("Previous summary");
    expect(updated?.lastTurnInputTokens).toBe(98_000);
  });

  it("returns timeout error instead of hanging when run.wait exceeds limit", async () => {
    process.env.TELEGRAM_AGENT_RUN_TIMEOUT_MS = "15000";
    await seedThread({ cursorAgentId: null });

    cursorMock.create.mockImplementationOnce(async () => {
      const agent = makeMockAgent({
        agentId: "agent-timeout",
        waitDelayMs: 20_000,
        onSend: () => ({
          status: "completed",
          result: "too-late",
          id: "late-run",
        }),
      });
      return {
        agentId: agent.agentId,
        send: agent.send,
        [Symbol.asyncDispose]: agent.dispose,
      };
    });

    const { runTelegramAgentTurn } = await loadAgent();
    const reply = await runTelegramAgentTurn({
      telegramUserId: TG_USER,
      telegramChatId: TG_CHAT,
      userMessage: "Timeout test",
    });

    expect(reply).toMatch(/timeout/i);
    expect(reply).toMatch(/\/reset/i);
  });

  it("serializes concurrent user turns on the same Telegram thread", async () => {
    await seedThread({ cursorAgentId: "agent-serial" });
    const order: string[] = [];
    let resumeCalls = 0;

    cursorMock.resume.mockImplementation(async (agentId: string) => {
      resumeCalls += 1;
      const turn = resumeCalls;
      const agent = makeMockAgent({
        agentId,
        onSend: async () => {
          if (turn === 1) {
            order.push("start-a");
            await new Promise((r) => setTimeout(r, 80));
            order.push("end-a");
            return {
              status: "completed",
              result: "A",
              usage: { inputTokens: 500 },
              id: "a",
            };
          }
          order.push("start-b");
          order.push("end-b");
          return {
            status: "completed",
            result: "B",
            usage: { inputTokens: 600 },
            id: "b",
          };
        },
      });
      return {
        agentId: agent.agentId,
        send: agent.send,
        [Symbol.asyncDispose]: agent.dispose,
      };
    });

    const { runTelegramAgentTurn } = await loadAgent();
    const p1 = runTelegramAgentTurn({
      telegramUserId: TG_USER,
      telegramChatId: TG_CHAT,
      userMessage: "A",
    });
    const p2 = runTelegramAgentTurn({
      telegramUserId: TG_USER,
      telegramChatId: TG_CHAT,
      userMessage: "B",
    });

    await Promise.all([p1, p2]);
    expect(order).toEqual(["start-a", "end-a", "start-b", "end-b"]);
  });

  it("includes sessionSummary in bootstrap after compaction", async () => {
    await seedThread({
      cursorAgentId: null,
      sessionSummary: "Continuité article X.",
    });

    cursorMock.create.mockImplementationOnce(async () => {
      const agent = makeMockAgent({
        agentId: "agent-bootstrap",
        onSend: (message) => {
          expect(message).toContain("Continuité article X.");
          return {
            status: "completed",
            result: "bootstrap-ok",
            usage: { inputTokens: 800 },
            id: "boot",
          };
        },
      });
      return {
        agentId: agent.agentId,
        send: agent.send,
        [Symbol.asyncDispose]: agent.dispose,
      };
    });

    const { runTelegramAgentTurn } = await loadAgent();
    const reply = await runTelegramAgentTurn({
      telegramUserId: TG_USER,
      telegramChatId: TG_CHAT,
      userMessage: "Reprise",
    });
    expect(reply).toContain("bootstrap-ok");
  });
});
