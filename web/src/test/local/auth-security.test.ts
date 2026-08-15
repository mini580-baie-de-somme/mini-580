import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  AUTH_INVALID_CREDENTIALS,
  AUTH_OTP_REQUEST_ACK,
  AUTH_OTP_VERIFY_FAILED,
} from "@/lib/auth-messages";
import { requestAuthOtp, verifyAuthOtp } from "@/lib/auth-otp";
import { AuthOtpPurpose } from "@/generated/prisma/client";
import { ensureAdminUser, jsonRequest } from "../helpers";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

vi.mock("@/lib/telegram/api", () => ({
  sendTelegramPlainText: vi.fn(async () => undefined),
  getTelegramBotToken: () => "test-token",
}));

describe("auth security — anti-enumeration", () => {
  beforeAll(async () => {
    await ensureAdminUser();
  });

  it("login returns generic message for unknown email", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(
      jsonRequest("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: `no-such-user-${Date.now()}@test.local`,
          password: "wrong-password",
        }),
      })
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe(AUTH_INVALID_CREDENTIALS);
    expect(body.error).not.toMatch(/email|authorized|telegram/i);
  });

  it("login returns same generic message for wrong password on known admin", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(
      jsonRequest("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "admin@classmini580.blog",
          password: "definitely-wrong-password",
        }),
      })
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe(AUTH_INVALID_CREDENTIALS);
  });

  it("OTP request ack is generic for unknown email", async () => {
    const result = await requestAuthOtp({
      email: `ghost-${Date.now()}@test.local`,
      purpose: AuthOtpPurpose.LOGIN,
    });
    expect(result.ok).toBe(true);
  });

  it("OTP verify returns generic failure for wrong code", async () => {
    const result = await verifyAuthOtp({
      email: `ghost-${Date.now()}@test.local`,
      purpose: AuthOtpPurpose.LOGIN,
      code: "0000",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(AUTH_OTP_VERIFY_FAILED);
      expect(result.error).not.toMatch(/email|telegram|authorized/i);
    }
  });

  it("exports stable generic OTP request ack copy", () => {
    expect(AUTH_OTP_REQUEST_ACK).toMatch(/Si un compte associé existe/i);
    expect(AUTH_OTP_REQUEST_ACK).not.toMatch(/introuvable|inconnu|invalid email/i);
  });
});
