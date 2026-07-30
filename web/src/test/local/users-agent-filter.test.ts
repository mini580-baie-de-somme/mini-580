import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UserStatus } from "@/generated/prisma/client";
import { isTelegramUserAllowed } from "@/lib/service-auth";
import { prisma } from "@/lib/db";
import { agentCallableTools } from "@/lib/ai-tools-runtime";
import { systemBriefForAgent } from "@/lib/telegram/agent";
import { ensureAdminUser } from "../helpers";

const DB_TG = "9000000101";

describe("DB-based telegram allowlist", () => {
  const email = "it-tg-db-allow@test.local";
  let userId: string;
  const saved = process.env.TELEGRAM_ALLOWED_USER_IDS;

  beforeAll(async () => {
    await ensureAdminUser();
    delete process.env.TELEGRAM_ALLOWED_USER_IDS;
    const user = await prisma.user.create({
      data: {
        email,
        firstName: "Db",
        lastName: "Allow",
        name: "Db Allow",
        telegramUserId: DB_TG,
        passwordHash: "!",
        status: UserStatus.ACTIVE,
        isAdmin: false,
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    if (saved === undefined) delete process.env.TELEGRAM_ALLOWED_USER_IDS;
    else process.env.TELEGRAM_ALLOWED_USER_IDS = saved;
  });

  it("allows ACTIVE user by telegramUserId without env allowlist", async () => {
    expect(await isTelegramUserAllowed(DB_TG)).toBe(true);
  });

  it("denies INACTIVE user even if previously allowed in DB", async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.INACTIVE },
    });
    expect(await isTelegramUserAllowed(DB_TG)).toBe(false);
    await prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.ACTIVE },
    });
  });
});

describe("agentCallableTools admin filter", () => {
  it("excludes users.* for non-admin", () => {
    const tools = agentCallableTools({ isAdmin: false }).map((t) => t.name);
    expect(tools.some((n) => n.startsWith("users."))).toBe(false);
  });

  it("includes users.* for admin", () => {
    const tools = agentCallableTools({ isAdmin: true }).map((t) => t.name);
    expect(tools).toContain("users.list");
    expect(tools).toContain("users.create");
    expect(tools).toContain("users.invite");
  });
});

describe("systemBriefForAgent role conditioning", () => {
  it("includes users_* guidance for admin", () => {
    const brief = systemBriefForAgent(true);
    expect(brief).toContain("users_list");
    expect(brief).toContain("users_invite");
    expect(brief).toContain("users_setAdmin");
  });

  it("tells non-admin that users tools are unavailable", () => {
    const brief = systemBriefForAgent(false);
    expect(brief).not.toContain("users_list");
    expect(brief).toContain("n'as pas les tools users_*");
  });
});
