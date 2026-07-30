import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AuthOtpPurpose, UserStatus } from "@/generated/prisma/client";
import { createTestOtpChallenge } from "@/lib/auth-otp";
import { prisma } from "@/lib/db";
import { TELEGRAM_USER_ID_HEADER } from "@/lib/telegram-auth";
import {
  ADMIN_EMAIL,
  bearerHeaders,
  ensureAdminUser,
  ensureEditorUser,
  jsonRequest,
} from "../helpers";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

vi.mock("@/lib/telegram/api", () => ({
  sendTelegramPlainText: vi.fn(async () => undefined),
  getTelegramBotToken: () => "test-token",
}));

const EDITOR_EMAIL = "it-users-editor@test.local";
const EDITOR_TG = "9000000001";

describe("Users API — admin only", () => {
  let adminId: string;
  let editorId: string;

  beforeAll(async () => {
    const admin = await ensureAdminUser();
    adminId = admin.id;
    const editor = await ensureEditorUser({
      email: EDITOR_EMAIL,
      firstName: "Editor",
      lastName: "IT",
      telegramUserId: EDITOR_TG,
    });
    editorId = editor.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: EDITOR_EMAIL } });
  });

  it("GET /api/users returns 403 for non-admin Bearer editor", async () => {
    const { GET } = await import("@/app/api/users/route");
    const res = await GET(
      jsonRequest("http://localhost/api/users", {
        headers: bearerHeaders({ [TELEGRAM_USER_ID_HEADER]: EDITOR_TG }),
      })
    );
    expect(res.status).toBe(403);
  });

  it("GET /api/users returns 200 for admin Bearer", async () => {
    const { GET } = await import("@/app/api/users/route");
    const res = await GET(
      jsonRequest("http://localhost/api/users", {
        headers: bearerHeaders({ [TELEGRAM_USER_ID_HEADER]: "7257839706" }),
      })
    );
    expect(res.status).toBe(200);
    const users = await res.json();
    expect(Array.isArray(users)).toBe(true);
    expect(users.some((u: { id: string }) => u.id === adminId)).toBe(true);
  });

  it("POST /api/users creates user for admin Bearer", async () => {
    const { POST } = await import("@/app/api/users/route");
    const email = `it-new-user-${Date.now()}@test.local`;
    const res = await POST(
      jsonRequest("http://localhost/api/users", {
        method: "POST",
        headers: bearerHeaders({
          [TELEGRAM_USER_ID_HEADER]: "7257839706",
        }),
        body: JSON.stringify({
          firstName: "Nouveau",
          lastName: "Membre",
          email,
          telegramUserId: "9000000099",
        }),
      })
    );
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created.email).toBe(email);
    expect(created.status).toBe(UserStatus.ACTIVE);
    expect(created.isAdmin).toBe(false);

    await prisma.user.delete({ where: { id: created.id } });
  });

  it("POST deactivate + archive for admin Bearer", async () => {
    const email = `it-lifecycle-${Date.now()}@test.local`;
    const created = await prisma.user.create({
      data: {
        email,
        firstName: "Life",
        lastName: "Cycle",
        name: "Life Cycle",
        telegramUserId: `9${Date.now()}`.slice(0, 10),
        passwordHash: "!",
        status: UserStatus.ACTIVE,
        isAdmin: false,
      },
    });

    const { POST: deactivate } = await import(
      "@/app/api/users/[id]/deactivate/route"
    );
    const deactivated = await deactivate(
      jsonRequest(`http://localhost/api/users/${created.id}/deactivate`, {
        method: "POST",
        headers: bearerHeaders({ [TELEGRAM_USER_ID_HEADER]: "7257839706" }),
      }),
      { params: Promise.resolve({ id: created.id }) }
    );
    expect(deactivated.status).toBe(200);
    expect((await deactivated.json()).status).toBe(UserStatus.INACTIVE);

    const { POST: archive } = await import(
      "@/app/api/users/[id]/archive/route"
    );
    const archived = await archive(
      jsonRequest(`http://localhost/api/users/${created.id}/archive`, {
        method: "POST",
        headers: bearerHeaders({ [TELEGRAM_USER_ID_HEADER]: "7257839706" }),
      }),
      { params: Promise.resolve({ id: created.id }) }
    );
    expect(archived.status).toBe(200);
    expect((await archived.json()).status).toBe(UserStatus.ARCHIVED);

    await prisma.user.delete({ where: { id: created.id } });
  });

  it("non-admin cannot call set-admin", async () => {
    const { POST } = await import("@/app/api/users/[id]/set-admin/route");
    const res = await POST(
      jsonRequest(`http://localhost/api/users/${editorId}/set-admin`, {
        method: "POST",
        headers: bearerHeaders({ [TELEGRAM_USER_ID_HEADER]: EDITOR_TG }),
        body: JSON.stringify({ isAdmin: true }),
      }),
      { params: Promise.resolve({ id: editorId }) }
    );
    expect(res.status).toBe(403);
  });
});

describe("Auth OTP API", () => {
  const otpEmail = "it-otp-user@test.local";
  const otpTg = "9000000002";

  beforeAll(async () => {
    await ensureAdminUser();
    await prisma.user.upsert({
      where: { email: otpEmail },
      update: {
        telegramUserId: otpTg,
        status: UserStatus.ACTIVE,
      },
      create: {
        email: otpEmail,
        firstName: "Otp",
        lastName: "User",
        name: "Otp User",
        telegramUserId: otpTg,
        passwordHash: "!",
        status: UserStatus.ACTIVE,
        isAdmin: false,
      },
    });
  });

  afterAll(async () => {
    await prisma.authOtpChallenge.deleteMany({ where: { email: otpEmail } });
    await prisma.user.deleteMany({ where: { email: otpEmail } });
  });

  it("POST /api/auth/otp/request sends via Telegram mock", async () => {
    const { sendTelegramPlainText } = await import("@/lib/telegram/api");
    const { POST } = await import("@/app/api/auth/otp/request/route");
    const res = await POST(
      jsonRequest("http://localhost/api/auth/otp/request", {
        method: "POST",
        body: JSON.stringify({ email: otpEmail, purpose: "LOGIN" }),
      })
    );
    expect(res.status).toBe(200);
    expect(sendTelegramPlainText).toHaveBeenCalled();
  });

  it("POST /api/auth/otp/verify sets session cookie on LOGIN", async () => {
    await prisma.authOtpChallenge.deleteMany({ where: { email: otpEmail } });
    await createTestOtpChallenge({
      email: otpEmail,
      purpose: AuthOtpPurpose.LOGIN,
      code: "1234",
    });

    const { POST } = await import("@/app/api/auth/otp/verify/route");
    const res = await POST(
      jsonRequest("http://localhost/api/auth/otp/verify", {
        method: "POST",
        body: JSON.stringify({
          email: otpEmail,
          code: "1234",
          purpose: "LOGIN",
        }),
      })
    );
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toMatch(/session=/i);
  });
});
