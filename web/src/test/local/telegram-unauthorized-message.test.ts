import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { UserStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { buildUnauthorizedWelcome } from "@/lib/telegram/unauthorized-message";

describe("buildUnauthorizedWelcome", () => {
  const prevSite = process.env.SITE_URL;
  const unknownTelegramId = "888777666";

  beforeEach(() => {
    process.env.SITE_URL = "https://test.classmini580.blog";
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { telegramUserId: unknownTelegramId } });
    if (prevSite === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = prevSite;
  });

  it("includes blog and connexion links for unknown users without OTP session", async () => {
    const reply = await buildUnauthorizedWelcome({
      id: Number(unknownTelegramId),
      first_name: "Alice",
      username: "alice",
    });

    expect(reply.text).toMatch(/Bienvenue Class Mini 5\.80/);
    expect(reply.text).toMatch(/888777666/);
    expect(reply.text).toMatch(/invitation|inv_/);
    expect(reply.text).toContain("https://test.classmini580.blog/blog");
    expect(reply.text).toContain("https://test.classmini580.blog/connexion");
    expect(reply.text).toMatch(/Code Telegram/);
  });

  it("uses prod site URL when SITE_URL points to prod", async () => {
    process.env.SITE_URL = "https://classmini580.blog";
    const reply = await buildUnauthorizedWelcome({ id: Number(unknownTelegramId) });
    expect(reply.text).toContain("https://classmini580.blog/blog");
    expect(reply.text).toContain("https://classmini580.blog/connexion");
  });

  it("omits blog links for inactive known accounts", async () => {
    await prisma.user.create({
      data: {
        email: `inactive-${unknownTelegramId}@example.com`,
        name: "Inactive User",
        passwordHash: "!",
        telegramUserId: unknownTelegramId,
        status: UserStatus.INACTIVE,
      },
    });

    const reply = await buildUnauthorizedWelcome({ id: Number(unknownTelegramId) });
    expect(reply.text).toMatch(/désactivé/);
    expect(reply.text).not.toContain("/blog");
    expect(reply.text).not.toContain("/connexion");
  });
});
