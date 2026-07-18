import { beforeAll, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/constants";
import { prisma } from "@/lib/db";
import {
  listPlatformEditors,
  validatePlatformAuthorId,
} from "@/lib/editors";
import {
  ADMIN_EMAIL,
  bearerHeaders,
  ensureAdminUser,
  jsonRequest,
  uniqueSlug,
} from "../helpers";

const { mockSessionToken } = vi.hoisted(() => ({
  mockSessionToken: { current: undefined as string | undefined },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === SESSION_COOKIE && mockSessionToken.current
        ? { value: mockSessionToken.current }
        : undefined,
  }),
}));

describe("Platform editors + post author", () => {
  beforeAll(async () => {
    await ensureAdminUser();
  });

  it("lists only allowlisted users from DB", async () => {
    const editors = await listPlatformEditors();
    expect(editors.some((e) => e.email === ADMIN_EMAIL)).toBe(true);
  });

  it("validates platform author ids", async () => {
    const admin = await ensureAdminUser();
    expect(await validatePlatformAuthorId(admin.id)).toBe(admin.id);
    expect(await validatePlatformAuthorId("not-a-real-id")).toBeNull();
  });

  it("changes author on session PATCH", async () => {
    const admin = await ensureAdminUser();
    const laurentEmail = `it-laurent-${Date.now()}@classmini580.blog`;
    const passwordHash = await hashPassword("changeme123");
    const laurent = await prisma.user.create({
      data: {
        email: laurentEmail,
        name: "Laurent IT",
        passwordHash,
      },
    });

    const prevAllowlist = process.env.EDITORS_ALLOWLIST;
    process.env.EDITORS_ALLOWLIST = `${ADMIN_EMAIL},${laurentEmail}`;

    try {
      const { createSessionToken } = await import("@/lib/auth");
      mockSessionToken.current = await createSessionToken(admin);

      const { POST } = await import("@/app/api/posts/route");
      const marker = uniqueSlug("it-author");
      const createRes = await POST(
        jsonRequest("http://localhost/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ titleFr: marker, titleEn: marker }),
        })
      );
      expect(createRes.status).toBe(201);
      const created = await createRes.json();
      expect(created.authorId).toBe(admin.id);

      const { PATCH } = await import("@/app/api/posts/[id]/route");
      const ctx = { params: Promise.resolve({ id: created.id }) };

      const patchRes = await PATCH(
        jsonRequest(`http://localhost/api/posts/${created.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ authorId: laurent.id }),
        }),
        ctx
      );
      expect(patchRes.status).toBe(200);
      const patched = await patchRes.json();
      expect(patched.authorId).toBe(laurent.id);
      expect(patched.author.name).toBe("Laurent IT");

      await prisma.post.delete({ where: { id: created.id } });
    } finally {
      process.env.EDITORS_ALLOWLIST = prevAllowlist;
      await prisma.user.delete({ where: { id: laurent.id } });
      mockSessionToken.current = undefined;
    }
  });

  it("rejects authorId not on allowlist", async () => {
    const admin = await ensureAdminUser();
    const outsiderEmail = `it-outsider-${Date.now()}@example.com`;
    const outsider = await prisma.user.create({
      data: {
        email: outsiderEmail,
        name: "Outsider",
        passwordHash: await hashPassword("changeme123"),
      },
    });

    const { createSessionToken } = await import("@/lib/auth");
    mockSessionToken.current = await createSessionToken(admin);

    const { POST } = await import("@/app/api/posts/route");
    const marker = uniqueSlug("it-author-bad");
    const createRes = await POST(
      jsonRequest("http://localhost/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titleFr: marker,
          titleEn: marker,
          authorId: outsider.id,
        }),
      })
    );
    expect(createRes.status).toBe(400);

    mockSessionToken.current = undefined;
    await prisma.user.delete({ where: { id: outsider.id } });
  });

  it("ignores authorId override on Bearer create", async () => {
    const admin = await ensureAdminUser();
    const { POST } = await import("@/app/api/posts/route");
    const marker = uniqueSlug("it-author-bearer");

    const createRes = await POST(
      jsonRequest("http://localhost/api/posts", {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({
          titleFr: marker,
          titleEn: marker,
          authorId: "fake-other-author-id",
        }),
      })
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.authorId).toBe(admin.id);

    await prisma.post.delete({ where: { id: created.id } });
  });
});
