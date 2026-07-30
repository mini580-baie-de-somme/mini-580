import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { UserStatus } from "@/generated/prisma/client";
import {
  createUserInvite,
  formatInviteTag,
  parseInvitePayload,
  redeemUserInvite,
} from "@/lib/user-invite";
import { prisma } from "@/lib/db";
import { TELEGRAM_USER_ID_HEADER } from "@/lib/telegram-auth";
import { bearerHeaders, ensureAdminUser, jsonRequest } from "../helpers";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

vi.mock("@/lib/telegram/api", () => ({
  sendTelegramPlainText: vi.fn(async () => undefined),
  getTelegramBotToken: () => "test-token",
  getTelegramBotUsername: vi.fn(async () => "ClassMini580TestBot"),
}));

describe("user invite tokens", () => {
  const email = `it-invite-${Date.now()}@test.local`;
  let userId: string;
  let tokenBody: string;

  beforeAll(async () => {
    await ensureAdminUser();
    process.env.SITE_URL = "https://test.classmini580.blog";
    const result = await createUserInvite({
      firstName: "Invite",
      lastName: "Test",
      email,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("invite setup failed");
    userId = result.user.id;
    tokenBody = result.invite.inviteTag.replace(/^inv_/, "");
  });

  afterAll(async () => {
    await prisma.userInvite.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { email } });
  });

  it("parseInvitePayload accepts inv_ prefix", () => {
    expect(parseInvitePayload(formatInviteTag(tokenBody))).toBe(tokenBody);
    expect(parseInvitePayload(tokenBody)).toBe(tokenBody);
  });

  it("creates PENDING user without telegramUserId", async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.status).toBe(UserStatus.PENDING);
    expect(user.telegramUserId).toBeNull();
  });

  it("redeems invite and activates user", async () => {
    const tg = "9000007777";
    const redeemed = await redeemUserInvite({
      payload: formatInviteTag(tokenBody),
      telegramUserId: tg,
      telegramLabel: "@invitee",
    });
    expect(redeemed.ok).toBe(true);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.status).toBe(UserStatus.ACTIVE);
    expect(user.telegramUserId).toBe(tg);

    const invite = await prisma.userInvite.findUniqueOrThrow({
      where: { userId },
    });
    expect(invite.usedAt).not.toBeNull();
  });

  it("rejects already-used invite", async () => {
    const redeemed = await redeemUserInvite({
      payload: formatInviteTag(tokenBody),
      telegramUserId: "9000008888",
    });
    expect(redeemed.ok).toBe(false);
  });
});

describe("POST /api/users/invite", () => {
  it("returns copyPasteMessage for admin Bearer", async () => {
    const email = `it-invite-api-${Date.now()}@test.local`;
    const { POST } = await import("@/app/api/users/invite/route");
    const res = await POST(
      jsonRequest("http://localhost/api/users/invite", {
        method: "POST",
        headers: bearerHeaders({
          [TELEGRAM_USER_ID_HEADER]: "7257839706",
        }),
        body: JSON.stringify({
          firstName: "Api",
          lastName: "Invite",
          email,
        }),
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.inviteTag).toMatch(/^inv_[A-Z2-9]+$/);
    expect(body.copyPasteMessage).toContain(body.inviteLink);
    expect(body.copyPasteMessage).toContain(email);
    expect(body.user.status).toBe(UserStatus.PENDING);

    await prisma.userInvite.deleteMany({ where: { userId: body.user.id } });
    await prisma.user.delete({ where: { id: body.user.id } });
  });
});
