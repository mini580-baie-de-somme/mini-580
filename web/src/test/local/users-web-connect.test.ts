import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { UserStatus } from "@/generated/prisma/client";
import { verifyAuthOtp } from "@/lib/auth-otp";
import { prisma } from "@/lib/db";
import {
  buildWebConnectUrl,
  createWebConnectLink,
  redeemWebConnectLink,
} from "@/lib/web-connect-link";
import { ensureAdminUser } from "../helpers";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

describe("web connect links", () => {
  const email = `it-webconnect-${Date.now()}@test.local`;
  let userId: string;
  let token = "";

  beforeAll(async () => {
    await ensureAdminUser();
    process.env.SITE_URL = "https://test.classmini580.blog";

    const user = await prisma.user.create({
      data: {
        email,
        firstName: "Web",
        lastName: "Connect",
        name: "Web Connect",
        telegramUserId: `9${Date.now().toString().slice(-9)}`,
        passwordHash: "!",
        status: UserStatus.ACTIVE,
        isAdmin: false,
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.webConnectLink.deleteMany({ where: { userId } });
    await prisma.authOtpChallenge.deleteMany({ where: { email } });
    await prisma.user.deleteMany({ where: { email } });
  });

  it("creates link with URL and OTP code", async () => {
    const result = await createWebConnectLink({ userId });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("create failed");

    expect(result.connect.connectUrl).toContain("/connexion/lien/");
    expect(result.connect.otpCode).toMatch(/^\d{4}$/);
    expect(result.connect.copyPasteMessage).toContain(result.connect.connectUrl);
    expect(result.connect.copyPasteMessage).toContain(result.connect.otpCode);

    token = result.connect.connectUrl.split("/").pop()!;
    expect(token).toMatch(/^[a-f0-9]{48}$/);
  });

  it("buildWebConnectUrl uses public site base", () => {
    expect(buildWebConnectUrl("abc")).toBe(
      "https://test.classmini580.blog/connexion/lien/abc"
    );
  });

  it("redeems magic link and marks used", async () => {
    const redeemed = await redeemWebConnectLink(token);
    expect(redeemed.ok).toBe(true);

    const again = await redeemWebConnectLink(token);
    expect(again.ok).toBe(false);
    if (again.ok) throw new Error("expected failure");
    expect(again.reason).toBe("used");
  });

  it("OTP fallback works until link is consumed", async () => {
    const created = await createWebConnectLink({ userId });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error("create failed");

    const verified = await verifyAuthOtp({
      email,
      code: created.connect.otpCode,
      purpose: "LOGIN",
    });
    expect(verified.ok).toBe(true);

    const linkToken = created.connect.connectUrl.split("/").pop()!;
    const magic = await redeemWebConnectLink(linkToken);
    expect(magic.ok).toBe(false);
    if (magic.ok) throw new Error("expected failure");
    expect(magic.reason).toBe("used");
  });

  it("rejects INACTIVE user", async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.INACTIVE },
    });

    const result = await createWebConnectLink({ userId });
    expect(result.ok).toBe(false);

    await prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.ACTIVE },
    });
  });
});
