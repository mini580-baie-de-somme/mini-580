import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  parseTelegramUserMap,
  resolveServiceEditorUser,
  resolveTelegramAuthorUser,
  TELEGRAM_USER_ID_HEADER,
} from "@/lib/telegram-auth";
import { getEditorOrService } from "@/lib/service-auth";
import {
  ADMIN_EMAIL,
  bearerHeaders,
  cleanupTestPosts,
  ensureAdminUser,
  INGEST_KEY,
  jsonRequest,
  uniqueSlug,
} from "../helpers";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

const LAURENT_TG = "8137936505";
const HAMMED_TG = "7257839706";
const LAURENT_EMAIL = "it-laurent-telegram@test.local";
const PREFIX = "it-tg-author";

describe("Telegram author mapping", () => {
  let adminId: string;
  let laurentId: string;
  const savedEnv: Record<string, string | undefined> = {};

  beforeAll(async () => {
    const admin = await ensureAdminUser();
    adminId = admin.id;

    const passwordHash = await hashPassword("changeme123");
    const laurent = await prisma.user.upsert({
      where: { email: LAURENT_EMAIL },
      update: { name: "Laurent IT", telegramUserId: null },
      create: {
        email: LAURENT_EMAIL,
        name: "Laurent IT",
        passwordHash,
      },
    });
    laurentId = laurent.id;

    savedEnv.TELEGRAM_ALLOWED_USER_IDS =
      process.env.TELEGRAM_ALLOWED_USER_IDS;
    savedEnv.TELEGRAM_SERVICE_USER_EMAIL =
      process.env.TELEGRAM_SERVICE_USER_EMAIL;
    savedEnv.TELEGRAM_USER_MAP = process.env.TELEGRAM_USER_MAP;

    process.env.TELEGRAM_ALLOWED_USER_IDS = `${LAURENT_TG},${HAMMED_TG}`;
    process.env.TELEGRAM_SERVICE_USER_EMAIL = ADMIN_EMAIL;

    await cleanupTestPosts(PREFIX);
  });

  afterAll(async () => {
    await cleanupTestPosts(PREFIX);
    await prisma.user.deleteMany({ where: { email: LAURENT_EMAIL } });

    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("parseTelegramUserMap splits telegramId:email pairs", () => {
    process.env.TELEGRAM_USER_MAP = `${LAURENT_TG}:${LAURENT_EMAIL}, ${HAMMED_TG}:${ADMIN_EMAIL}`;
    const map = parseTelegramUserMap();
    expect(map.get(LAURENT_TG)).toBe(LAURENT_EMAIL);
    expect(map.get(HAMMED_TG)).toBe(ADMIN_EMAIL);
  });

  it("resolveServiceEditorUser returns TELEGRAM_SERVICE_USER_EMAIL user", async () => {
    const user = await resolveServiceEditorUser();
    expect(user?.id).toBe(adminId);
    expect(user?.email).toBe(ADMIN_EMAIL);
  });

  it("maps via User.telegramUserId in DB", async () => {
    await prisma.user.update({
      where: { id: laurentId },
      data: { telegramUserId: LAURENT_TG },
    });
    delete process.env.TELEGRAM_USER_MAP;

    const user = await resolveTelegramAuthorUser(LAURENT_TG);
    expect(user?.id).toBe(laurentId);
    expect(user?.email).toBe(LAURENT_EMAIL);

    await prisma.user.update({
      where: { id: laurentId },
      data: { telegramUserId: null },
    });
  });

  it("maps via TELEGRAM_USER_MAP when DB column unset", async () => {
    process.env.TELEGRAM_USER_MAP = `${LAURENT_TG}:${LAURENT_EMAIL}`;

    const user = await resolveTelegramAuthorUser(LAURENT_TG);
    expect(user?.id).toBe(laurentId);
    expect(user?.email).toBe(LAURENT_EMAIL);

    delete process.env.TELEGRAM_USER_MAP;
  });

  it("falls back to service user for allowed id without mapping", async () => {
    delete process.env.TELEGRAM_USER_MAP;

    const user = await resolveTelegramAuthorUser(HAMMED_TG);
    expect(user?.id).toBe(adminId);
    expect(user?.email).toBe(ADMIN_EMAIL);
  });

  it("falls back to service user when telegram id not in allowlist", async () => {
    process.env.TELEGRAM_USER_MAP = `${LAURENT_TG}:${LAURENT_EMAIL}`;

    const user = await resolveTelegramAuthorUser("9999999999");
    expect(user?.id).toBe(adminId);

    delete process.env.TELEGRAM_USER_MAP;
  });

  it("getEditorOrService uses X-Telegram-User-Id with Bearer", async () => {
    process.env.TELEGRAM_USER_MAP = `${LAURENT_TG}:${LAURENT_EMAIL}`;

    const editor = await getEditorOrService(
      jsonRequest("http://localhost/api/posts", {
        headers: {
          Authorization: `Bearer ${INGEST_KEY}`,
          [TELEGRAM_USER_ID_HEADER]: LAURENT_TG,
        },
      })
    );
    expect(editor?.id).toBe(laurentId);
    expect(editor?.email).toBe(LAURENT_EMAIL);

    delete process.env.TELEGRAM_USER_MAP;
  });

  it("creates post with mapped author via Bearer + X-Telegram-User-Id", async () => {
    process.env.TELEGRAM_USER_MAP = `${LAURENT_TG}:${LAURENT_EMAIL}`;
    const marker = uniqueSlug(PREFIX);

    const { POST } = await import("@/app/api/posts/route");
    const res = await POST(
      jsonRequest("http://localhost/api/posts", {
        method: "POST",
        headers: bearerHeaders({
          [TELEGRAM_USER_ID_HEADER]: LAURENT_TG,
        }),
        body: JSON.stringify({
          titleFr: marker,
          titleEn: "TG author test",
        }),
      })
    );
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created.authorId).toBe(laurentId);
    expect(created.author.email).toBe(LAURENT_EMAIL);

    delete process.env.TELEGRAM_USER_MAP;
  });
});
