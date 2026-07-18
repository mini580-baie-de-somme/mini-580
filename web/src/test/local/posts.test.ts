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
    // Title marker ensures auto-slug starts with PREFIX (cleanup + assertion).
    const marker = uniqueSlug(PREFIX);
    const ignoredClientSlug = uniqueSlug(`${PREFIX}-ignored`);

    const createRes = await POST(
      jsonRequest("http://localhost/api/posts", {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({
          titleFr: marker,
          titleEn: "Hull EN",
          excerptFr: "Extrait FR",
          excerptEn: "Excerpt EN",
          bodyFr: "Corps **FR**",
          bodyEn: "Body **EN**",
          slug: ignoredClientSlug,
        }),
      })
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.titleFr).toBe(marker);
    expect(created.titleEn).toBe("Hull EN");
    expect(created.bodyFr).toContain("FR");
    expect(created.bodyEn).toContain("EN");
    expect(created.status).toBe("DRAFT");
    expect(created.authorId).toBe(adminId);
    expect(created.author.email).toBe(ADMIN_EMAIL);
    // Slug is auto-generated from titleFr — client slug is ignored.
    expect(created.slug).toBe(marker);
    expect(created.slug).not.toBe(ignoredClientSlug);

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

    // publishedAt must accept datetime-local (editor) and persist.
    const datePatch = await PATCH(
      jsonRequest(`http://localhost/api/posts/${created.id}`, {
        method: "PATCH",
        headers: bearerHeaders(),
        body: JSON.stringify({
          publishedAt: "2025-06-15T10:30",
        }),
      }),
      ctx
    );
    expect(datePatch.status).toBe(200);
    const dated = await datePatch.json();
    expect(dated.publishedAt).toBeTruthy();
    expect(new Date(dated.publishedAt).getUTCFullYear()).toBe(2025);
    expect(new Date(dated.publishedAt).getUTCMonth()).toBe(5);

    const clearDate = await PATCH(
      jsonRequest(`http://localhost/api/posts/${created.id}`, {
        method: "PATCH",
        headers: bearerHeaders(),
        body: JSON.stringify({ publishedAt: null }),
      }),
      ctx
    );
    expect(clearDate.status).toBe(200);
    expect((await clearDate.json()).publishedAt).toBeNull();

    const updatedTitle = uniqueSlug(`${PREFIX}-upd`);
    const patchRes = await PATCH(
      jsonRequest(`http://localhost/api/posts/${created.id}`, {
        method: "PATCH",
        headers: bearerHeaders(),
        body: JSON.stringify({
          titleFr: updatedTitle,
          titleEn: "Updated title",
          bodyEn: "Updated body EN",
          slug: "manual-slug-should-be-ignored",
        }),
      }),
      ctx
    );
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.titleFr).toBe(updatedTitle);
    expect(patched.titleEn).toBe("Updated title");
    expect(patched.bodyEn).toBe("Updated body EN");
    expect(patched.bodyFr).toContain("FR");
    // DRAFT: slug stays in sync with titleFr; client slug ignored.
    expect(patched.slug).toBe(updatedTitle);
    expect(patched.slug).not.toBe("manual-slug-should-be-ignored");

    // Publish freezes the slug even if titleFr changes.
    const { POST: publish } = await import(
      "@/app/api/posts/[id]/publish/route"
    );
    const statusRes = await publish(
      jsonRequest(`http://localhost/api/posts/${created.id}/publish`, {
        method: "POST",
        headers: bearerHeaders(),
      }),
      ctx
    );
    expect(statusRes.status).toBe(200);

    const frozenSlug = patched.slug;
    const afterPublish = await PATCH(
      jsonRequest(`http://localhost/api/posts/${created.id}`, {
        method: "PATCH",
        headers: bearerHeaders(),
        body: JSON.stringify({
          titleFr: uniqueSlug(`${PREFIX}-frozen`),
        }),
      }),
      ctx
    );
    expect(afterPublish.status).toBe(200);
    const frozen = await afterPublish.json();
    expect(frozen.slug).toBe(frozenSlug);

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

    // list still works (paginated editor response)
    const list = await GET(
      jsonRequest("http://localhost/api/posts", { headers: bearerHeaders() })
    );
    expect(list.status).toBe(200);
    const body = (await list.json()) as { items: unknown[]; total: number };
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it("filters and paginates editor list server-side", async () => {
    const { POST, GET } = await import("@/app/api/posts/route");
    const markerA = uniqueSlug(`${PREFIX}-a`);
    const markerB = uniqueSlug(`${PREFIX}-b`);
    const searchToken = `zoulou${Date.now().toString(36)}`;

    const createA = await POST(
      jsonRequest("http://localhost/api/posts", {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({
          titleFr: `${markerA} Alpha ${searchToken}`,
          titleEn: "Alpha zulu",
        }),
      })
    );
    expect(createA.status).toBe(201);
    const postA = await createA.json();
    expect(postA.slug.startsWith(markerA)).toBe(true);

    const createB = await POST(
      jsonRequest("http://localhost/api/posts", {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({
          titleFr: `${markerB} Bravo charlie`,
          titleEn: "Bravo charlie",
        }),
      })
    );
    expect(createB.status).toBe(201);

    const searchRes = await GET(
      jsonRequest("http://localhost/api/posts", {
        headers: bearerHeaders(),
        searchParams: { q: searchToken, limit: "10", offset: "0" },
      })
    );
    expect(searchRes.status).toBe(200);
    const searchBody = (await searchRes.json()) as {
      items: { id: string }[];
      total: number;
      totalAll: number;
    };
    expect(searchBody.total).toBe(1);
    expect(searchBody.totalAll).toBeGreaterThanOrEqual(2);
    expect(searchBody.items[0]?.id).toBe(postA.id);

    const pageRes = await GET(
      jsonRequest("http://localhost/api/posts", {
        headers: bearerHeaders(),
        searchParams: { limit: "1", offset: "0" },
      })
    );
    const pageBody = (await pageRes.json()) as {
      items: unknown[];
      total: number;
      limit: number;
      offset: number;
    };
    expect(pageBody.items).toHaveLength(1);
    expect(pageBody.limit).toBe(1);
    expect(pageBody.offset).toBe(0);
    expect(pageBody.total).toBeGreaterThanOrEqual(2);
  });
});
