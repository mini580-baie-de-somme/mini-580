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

const EDITOR_EMAIL = "it-account-self@test.local";
const EDITOR_TG = "9000000203";

describe("Account self-service API", () => {
  let editorId: string;

  beforeAll(async () => {
    await ensureAdminUser();
    const editor = await ensureEditorUser({
      email: EDITOR_EMAIL,
      firstName: "Self",
      lastName: "Service",
      telegramUserId: EDITOR_TG,
    });
    editorId = editor.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: EDITOR_EMAIL } });
  });

  it("GET /api/account/me returns own profile for editor Bearer", async () => {
    const { GET } = await import("@/app/api/account/me/route");
    const res = await GET(
      jsonRequest("http://localhost/api/account/me", {
        headers: bearerHeaders({ [TELEGRAM_USER_ID_HEADER]: EDITOR_TG }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(editorId);
    expect(body.email).toBe(EDITOR_EMAIL);
    expect(body.isAdmin).toBe(false);
  });

  it("PATCH /api/account/me updates own profile", async () => {
    const { PATCH } = await import("@/app/api/account/me/route");
    const res = await PATCH(
      jsonRequest("http://localhost/api/account/me", {
        method: "PATCH",
        headers: bearerHeaders({ [TELEGRAM_USER_ID_HEADER]: EDITOR_TG }),
        body: JSON.stringify({ firstName: "SelfUpdated" }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.firstName).toBe("SelfUpdated");
  });

  it("POST /api/account/web-connect returns link for self", async () => {
    const { POST } = await import("@/app/api/account/web-connect/route");
    const res = await POST(
      jsonRequest("http://localhost/api/account/web-connect", {
        method: "POST",
        headers: bearerHeaders({ [TELEGRAM_USER_ID_HEADER]: EDITOR_TG }),
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.connectUrl).toContain("/connexion/lien/");
    expect(body.copyPasteMessage).toContain("bot Telegram");
  });

  it("POST /api/account/otp/login sends login OTP", async () => {
    const { POST } = await import("@/app/api/account/otp/login/route");
    const res = await POST(
      jsonRequest("http://localhost/api/account/otp/login", {
        method: "POST",
        headers: bearerHeaders({ [TELEGRAM_USER_ID_HEADER]: EDITOR_TG }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("POST /api/account/password sets password with OTP", async () => {
    await createTestOtpChallenge({
      email: EDITOR_EMAIL,
      purpose: AuthOtpPurpose.PASSWORD_RESET,
      code: "4321",
    });

    const { POST } = await import("@/app/api/account/password/route");
    const res = await POST(
      jsonRequest("http://localhost/api/account/password", {
        method: "POST",
        headers: bearerHeaders({ [TELEGRAM_USER_ID_HEADER]: EDITOR_TG }),
        body: JSON.stringify({ code: "4321", newPassword: "newpass123" }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.passwordUpdated).toBe(true);
  });

  it("GET /api/account/me returns 403 without auth", async () => {
    const { GET } = await import("@/app/api/account/me/route");
    const res = await GET(jsonRequest("http://localhost/api/account/me"));
    expect(res.status).toBe(401);
  });

  it("GET /api/users still forbidden for non-admin editor", async () => {
    const { GET } = await import("@/app/api/users/route");
    const res = await GET(
      jsonRequest("http://localhost/api/users", {
        headers: bearerHeaders({ [TELEGRAM_USER_ID_HEADER]: EDITOR_TG }),
      })
    );
    expect(res.status).toBe(403);
  });

  it("admin can still list users", async () => {
    const { GET } = await import("@/app/api/users/route");
    const res = await GET(
      jsonRequest("http://localhost/api/users", {
        headers: bearerHeaders({ [TELEGRAM_USER_ID_HEADER]: "7257839706" }),
      })
    );
    expect(res.status).toBe(200);
    const users = await res.json();
    expect(users.some((u: { email: string }) => u.email === ADMIN_EMAIL)).toBe(true);
  });
});
