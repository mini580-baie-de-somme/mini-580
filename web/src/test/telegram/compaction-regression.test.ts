import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { prisma } from "@/lib/db";
import type { TelegramUpdate } from "@/lib/telegram/webhook-handler";

const USER_ID = 990002002;
const CHAT_ID = 990002002;

const outbound: { text: string }[] = [];
const compactCalls: number[] = [];
const turnCalls: number[] = [];

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

vi.mock("@/lib/telegram/api", () => ({
  sendTelegramReply: vi.fn(
    async (_chatId: number | string, reply: { text: string }) => {
      outbound.push({ text: reply.text });
    }
  ),
  sendTelegramPlainText: vi.fn(
    async (_chatId: number | string, text: string) => {
      outbound.push({ text });
    }
  ),
  answerCallbackQuery: vi.fn(async () => undefined),
  downloadTelegramFile: vi.fn(async () => null),
  getTelegramBotToken: vi.fn(() => "test-bot-token"),
}));

vi.mock("@/lib/telegram/agent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/telegram/agent")>();
  return {
    ...actual,
    resetTelegramAgent: vi.fn(async () => undefined),
    runTelegramAgentTurn: vi.fn(async () => {
      turnCalls.push(Date.now());
      return "agent-reply-mock";
    }),
    maybeCompactTelegramSessionAfterTurn: vi.fn(async () => {
      compactCalls.push(Date.now());
    }),
  };
});

function textMsg(text: string): TelegramUpdate {
  return {
    update_id: 42,
    message: {
      message_id: 42,
      chat: { id: CHAT_ID, type: "private" },
      from: { id: USER_ID, username: "compact_it", first_name: "IT" },
      text,
    },
  };
}

describe("telegram compaction regression — webhook wiring", () => {
  beforeEach(() => {
    outbound.length = 0;
    compactCalls.length = 0;
    turnCalls.length = 0;
    vi.clearAllMocks();
    process.env.TELEGRAM_ALLOWED_USER_IDS = String(USER_ID);
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    process.env.TELEGRAM_WEBHOOK_SECRET = "";
  });

  afterEach(async () => {
    await prisma.telegramAgentThread.deleteMany({
      where: {
        telegramUserId: String(USER_ID),
        telegramChatId: String(CHAT_ID),
      },
    });
  });

  it("invokes compaction only after the user-visible agent reply", async () => {
    const { processTelegramUpdate } = await import(
      "@/lib/telegram/webhook-handler"
    );
    const { runTelegramAgentTurn, maybeCompactTelegramSessionAfterTurn } =
      await import("@/lib/telegram/agent");

    await processTelegramUpdate(textMsg("Question agent"));

    expect(runTelegramAgentTurn).toHaveBeenCalledTimes(1);
    expect(maybeCompactTelegramSessionAfterTurn).toHaveBeenCalledTimes(1);
    expect(outbound.some((o) => o.text.includes("agent-reply-mock"))).toBe(
      true
    );

    expect(compactCalls.length).toBe(1);
    expect(turnCalls.length).toBe(1);
    expect(compactCalls[0]).toBeGreaterThanOrEqual(turnCalls[0]);
  });

  it("does not invoke compaction when the agent turn throws", async () => {
    const { runTelegramAgentTurn, maybeCompactTelegramSessionAfterTurn } =
      await import("@/lib/telegram/agent");
    vi.mocked(runTelegramAgentTurn).mockRejectedValueOnce(
      new Error("agent boom")
    );

    const { processTelegramUpdate } = await import(
      "@/lib/telegram/webhook-handler"
    );
    await processTelegramUpdate(textMsg("Question qui plante"));

    expect(maybeCompactTelegramSessionAfterTurn).not.toHaveBeenCalled();
    expect(outbound.some((o) => o.text.includes("Erreur agent"))).toBe(true);
  });
});
