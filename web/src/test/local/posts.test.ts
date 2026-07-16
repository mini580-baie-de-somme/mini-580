import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import {
  ADMIN_EMAIL,
  bearerHeaders,
  cleanupTestPosts,
  ensureAdminUser,
  jsonRequest,
  uniqueSlug,
} from "../helpers";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

const PREFIX = "it-post";

describe("API integration — Posts CRUD + FR/EN", () => {
  let adminId: string;

  beforeAll(async () => {
    const admin = await ensureAdminUser();
    adminId = admin.id;
    await cleanupTestPosts(PREFIX);
  });

  afterAll(async () => {
    await cleanupTestPosts(PREFIX);
  });

  it("rejects create without auth", async () => {
    const { POST } = await import("@/app/api/posts/route");
    const res = await POST(
      jsonRequest("http://localhost/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titleFr: "x",
          titleEn: "x",
        }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("creates, reads, updates FR/EN, deletes with Bearer", async () => {
    const { POST, GET } = await import("@/app/api/posts/route");
    const slug = uniqueSlug(PREFIX);

    const createRes = await POST(
      jsonRequest("http://localhost/api/posts", {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({
          titleFr: "Coque FR",
          titleEn: "Hull EN",
          excerptFr: "Extrait FR",
          excerptEn: "Excerpt EN",
          bodyFr: "Corps **FR**",
          bodyEn: "Body **EN**",
          slug,
        }),
      })
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.titleFr).toBe("Coque FR");
    expect(created.titleEn).toBe("Hull EN");
    expect(created.bodyFr).toContain("FR");
    expect(created.bodyEn).toContain("EN");
    expect(created.status).toBe("DRAFT");
    expect(created.authorId).toBe(adminId);
    expect(created.author.email).toBe(ADMIN_EMAIL);

    const { GET: getOne, PATCH, DELETE } = await import(
      "@/app/api/posts/[id]/route"
    );
    const ctx = { params: Promise.resolve({ id: created.id }) };

    const getRes = await getOne(
      jsonRequest(`http://localhost/api/posts/${created.id}`, {
        headers: bearerHeaders(),
      }),
      ctx
    );
    expect(getRes.status).toBe(200);
    const got = await getRes.json();
    expect(got.slug).toBe(created.slug);
    expect(created.slug).toContain(PREFIX);

    const patchRes = await PATCH(
      jsonRequest(`http://localhost/api/posts/${created.id}`, {
        method: "PATCH",
        headers: bearerHeaders(),
        body: JSON.stringify({
          titleFr: "Titre mis à jour",
          titleEn: "Updated title",
          bodyEn: "Updated body EN",
        }),
      }),
      ctx
    );
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.titleFr).toBe("Titre mis à jour");
    expect(patched.titleEn).toBe("Updated title");
    expect(patched.bodyEn).toBe("Updated body EN");
    expect(patched.bodyFr).toContain("FR");

    const delRes = await DELETE(
      jsonRequest(`http://localhost/api/posts/${created.id}`, {
        method: "DELETE",
        headers: bearerHeaders(),
      }),
      ctx
    );
    expect(delRes.status).toBe(200);

    const gone = await getOne(
      jsonRequest(`http://localhost/api/posts/${created.id}`),
      ctx
    );
    expect(gone.status).toBe(404);

    // list still works
    const list = await GET(jsonRequest("http://localhost/api/posts"));
    expect(list.status).toBe(200);
  });
});
