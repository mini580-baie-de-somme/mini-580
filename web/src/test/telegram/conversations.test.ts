import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  cleanupBySlug,
  cleanupTestPosts,
  ensureAdminUser,
  makeTestJpeg,
  resetMediaRoot,
  uniqueSlug,
} from "../helpers";
import { prisma } from "@/lib/db";
import type { TelegramUpdate } from "@/lib/telegram/webhook-handler";

const USER_ID = 7257839706;
const CHAT_ID = 7257839706;
const PREFIX = "it-tg-";

type Outbound = {
  chatId: number | string;
  text: string;
};

const outbound: Outbound[] = [];
let updateCounter = 1;

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

vi.mock("@/lib/telegram/api", () => ({
  sendTelegramReply: vi.fn(
    async (
      chatId: number | string,
      reply: { text: string }
    ) => {
      outbound.push({ chatId, text: reply.text });
    }
  ),
  answerCallbackQuery: vi.fn(async () => undefined),
  downloadTelegramFile: vi.fn(async () => {
    const buffer = await makeTestJpeg();
    return {
      buffer,
      filename: "telegram.jpg",
      contentType: "image/jpeg",
    };
  }),
  getTelegramBotToken: vi.fn(() => "test-bot-token"),
}));

function nextId() {
  return updateCounter++;
}

function textMsg(userId: number, text: string): TelegramUpdate {
  const id = nextId();
  return {
    update_id: id,
    message: {
      message_id: id,
      chat: { id: CHAT_ID, type: "private" },
      from: { id: userId, username: "it_user", first_name: "IT" },
      text,
    },
  };
}

function photoMsg(fileId: string, caption?: string): TelegramUpdate {
  const id = nextId();
  return {
    update_id: id,
    message: {
      message_id: id,
      chat: { id: CHAT_ID, type: "private" },
      from: { id: USER_ID, username: "it_user", first_name: "IT" },
      caption,
      photo: [
        { file_id: `${fileId}_s`, width: 90, height: 90 },
        { file_id: fileId, width: 1280, height: 960 },
      ],
    },
  };
}

function cb(data: string): TelegramUpdate {
  const id = nextId();
  return {
    update_id: id,
    callback_query: {
      id: `cq-${id}`,
      from: { id: USER_ID, username: "it_user", first_name: "IT" },
      data,
      message: {
        message_id: id,
        chat: { id: CHAT_ID, type: "private" },
        from: { id: USER_ID },
      },
    },
  };
}

describe("Telegram conversation simulations", () => {
  beforeAll(async () => {
    process.env.TELEGRAM_ALLOWED_USER_IDS = String(USER_ID);
    process.env.TELEGRAM_SERVICE_USER_EMAIL =
      process.env.SEED_ADMIN_EMAIL || "admin@classmini580.blog";
    delete process.env.CURSOR_API_KEY;

    await ensureAdminUser();
    await resetMediaRoot();
    await cleanupTestPosts(PREFIX);
    await cleanupBySlug("tag", PREFIX);
    await cleanupBySlug("milestone", PREFIX);
  });

  beforeEach(() => {
    outbound.length = 0;
  });

  afterAll(async () => {
    await prisma.telegramPublishSession.deleteMany({
      where: { telegramUserId: String(USER_ID) },
    });
    await cleanupTestPosts(PREFIX);
    await cleanupBySlug("tag", PREFIX);
    await cleanupBySlug("milestone", PREFIX);
  });

  it("scenario: one photo + text, new tag, FR approve then /traduire", async () => {
    const { processTelegramUpdate } = await import(
      "@/lib/telegram/webhook-handler"
    );
    const tagLabel = `IT-TG-${uniqueSlug(PREFIX)}`;

    await processTelegramUpdate(textMsg(USER_ID, "/nouveau"));
    expect(outbound.length).toBeGreaterThan(0);

    await processTelegramUpdate(photoMsg("file-photo-1"));
    expect(outbound.at(-1)?.text).toMatch(/photo/i);

    await processTelegramUpdate(
      textMsg(
        USER_ID,
        [
          `Titre: Pose quille ${PREFIX}`,
          "Texte: Première photo du chantier Baie de Somme.",
          `Tags: ${tagLabel}`,
        ].join("\n")
      )
    );

    await processTelegramUpdate(cb("content:done"));
    expect(outbound.at(-1)?.text.length).toBeGreaterThan(0);

    await processTelegramUpdate(cb("fr:approve"));
    await processTelegramUpdate(textMsg(USER_ID, "/traduire"));

    const session = await prisma.telegramPublishSession.findFirst({
      where: {
        telegramUserId: String(USER_ID),
        telegramChatId: String(CHAT_ID),
      },
      orderBy: { updatedAt: "desc" },
    });
    expect(session?.postId).toBeTruthy();

    const post = await prisma.post.findUnique({
      where: { id: session!.postId! },
      include: { tags: { include: { tag: true } }, images: true },
    });
    expect(post).toBeTruthy();
    expect(post!.images.length).toBeGreaterThanOrEqual(1);
    expect(post!.tags.some((t) => t.tag.labelFr.includes("IT-TG"))).toBe(true);
  });

  it("scenario: several photos then finish", async () => {
    const { processTelegramUpdate } = await import(
      "@/lib/telegram/webhook-handler"
    );

    await processTelegramUpdate(textMsg(USER_ID, "/nouveau"));
    await processTelegramUpdate(photoMsg("file-a"));
    await processTelegramUpdate(photoMsg("file-b", "caption B"));
    await processTelegramUpdate(photoMsg("file-c"));
    await processTelegramUpdate(
      textMsg(
        USER_ID,
        [`Titre: Multi photos ${PREFIX}`, "Texte: Trois photos du chantier."].join(
          "\n"
        )
      )
    );
    await processTelegramUpdate(cb("content:done"));

    const session = await prisma.telegramPublishSession.findFirst({
      where: {
        telegramUserId: String(USER_ID),
        telegramChatId: String(CHAT_ID),
      },
      orderBy: { updatedAt: "desc" },
    });
    expect(session?.postId).toBeTruthy();

    const post = await prisma.post.findUnique({
      where: { id: session!.postId! },
      include: { images: true },
    });
    expect(post!.images.length).toBe(3);
  });

  it("scenario: unauthorized user is rejected", async () => {
    const { processTelegramUpdate } = await import(
      "@/lib/telegram/webhook-handler"
    );
    await processTelegramUpdate(textMsg(999999999, "/nouveau"));
    const last = outbound.at(-1)?.text.toLowerCase() || "";
    expect(last.includes("autoris")).toBe(true);
  });
});
