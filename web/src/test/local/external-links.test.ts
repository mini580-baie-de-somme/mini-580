import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { externalLinkPlaceholder } from "@/lib/external-link-token";
import {
  bearerHeaders,
  cleanupTestPosts,
  ensureAdminUser,
  jsonRequest,
  uniqueSlug,
} from "../helpers";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

const LINK_P = "it-extlink-api";
const POST_P = "it-extlink-post";

describe("API integration — External links", () => {
  let linkId: string;
  let postId: string;

  beforeAll(async () => {
    await ensureAdminUser();
    await cleanupTestPosts(POST_P);
    await prisma.externalLink.deleteMany({
      where: { labelFr: { startsWith: LINK_P } },
    });
  });

  afterAll(async () => {
    await cleanupTestPosts(POST_P);
    if (linkId) {
      await prisma.externalLink.deleteMany({ where: { id: linkId } });
    }
    await prisma.externalLink.deleteMany({
      where: { labelFr: { startsWith: LINK_P } },
    });
  });

  it("CRUD external links with Bearer", async () => {
    const { POST, GET } = await import("@/app/api/external-links/route");

    const createRes = await POST(
      jsonRequest("http://localhost/api/external-links", {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({
          labelFr: `${LINK_P} FR`,
          labelEn: `${LINK_P} EN`,
          url: "https://example.com/docs",
        }),
      })
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    linkId = created.id;
    expect(created.url).toBe("https://example.com/docs");
    expect(created.urlFr).toBeNull();

    const listRes = await GET(
      jsonRequest("http://localhost/api/external-links", {
        headers: bearerHeaders(),
        searchParams: { q: LINK_P, paginated: "1" },
      })
    );
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    expect(list.items.some((l: { id: string }) => l.id === linkId)).toBe(true);

    const { GET: getOne, PATCH, DELETE } = await import(
      "@/app/api/external-links/[id]/route"
    );

    const detailRes = await getOne(
      jsonRequest(`http://localhost/api/external-links/${linkId}`, {
        headers: bearerHeaders(),
      }),
      { params: Promise.resolve({ id: linkId }) }
    );
    expect(detailRes.status).toBe(200);
    const detail = await detailRes.json();
    expect(detail.referencedByPostIds).toEqual([]);

    const patchRes = await PATCH(
      jsonRequest(`http://localhost/api/external-links/${linkId}`, {
        method: "PATCH",
        headers: bearerHeaders(),
        body: JSON.stringify({
          labelFr: `${LINK_P} modifié`,
          urlFr: "https://example.fr/page",
          urlEn: "https://example.com/page",
          url: null,
        }),
      }),
      { params: Promise.resolve({ id: linkId }) }
    );
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.labelFr).toBe(`${LINK_P} modifié`);
    expect(patched.url).toBeNull();
    expect(patched.urlFr).toBe("https://example.fr/page");

    const delRes = await DELETE(
      jsonRequest(`http://localhost/api/external-links/${linkId}`, {
        method: "DELETE",
        headers: bearerHeaders(),
      }),
      { params: Promise.resolve({ id: linkId }) }
    );
    expect(delRes.status).toBe(200);
    linkId = "";
  });

  it("DELETE returns 409 when link is referenced in post body", async () => {
    const { POST } = await import("@/app/api/external-links/route");
    const { POST: createPost } = await import("@/app/api/posts/route");
    const { PATCH: patchPost } = await import("@/app/api/posts/[id]/route");
    const { DELETE } = await import("@/app/api/external-links/[id]/route");
    const { GET: getRefs } = await import(
      "@/app/api/external-links/[id]/references/route"
    );

    const createLinkRes = await POST(
      jsonRequest("http://localhost/api/external-links", {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({
          labelFr: `${LINK_P} ref`,
          labelEn: "Ref EN",
          url: "https://example.com/ref",
        }),
      })
    );
    const link = await createLinkRes.json();
    linkId = link.id;
    const token = externalLinkPlaceholder(link.id);

    const postSlug = uniqueSlug(POST_P);
    const postRes = await createPost(
      jsonRequest("http://localhost/api/posts", {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({ titleFr: postSlug, titleEn: "EN" }),
      })
    );
    const post = await postRes.json();
    postId = post.id;

    await patchPost(
      jsonRequest(`http://localhost/api/posts/${postId}`, {
        method: "PATCH",
        headers: bearerHeaders(),
        body: JSON.stringify({ bodyFr: `Intro\n\n${token}\n\nFin` }),
      }),
      { params: Promise.resolve({ id: postId }) }
    );

    const refsRes = await getRefs(
      jsonRequest(`http://localhost/api/external-links/${linkId}/references`, {
        headers: bearerHeaders(),
      }),
      { params: Promise.resolve({ id: linkId }) }
    );
    expect(refsRes.status).toBe(200);
    const refs = await refsRes.json();
    expect(refs.total).toBe(1);
    expect(refs.posts[0]?.id).toBe(postId);

    const delRes = await DELETE(
      jsonRequest(`http://localhost/api/external-links/${linkId}`, {
        method: "DELETE",
        headers: bearerHeaders(),
      }),
      { params: Promise.resolve({ id: linkId }) }
    );
    expect(delRes.status).toBe(409);
    const delBody = await delRes.json();
    expect(delBody.referencedByPostIds).toContain(postId);
  });

  it("POST /api/posts/:id/insert-external-link injects placeholder", async () => {
    const { POST: createLink } = await import("@/app/api/external-links/route");
    const { POST: createPost } = await import("@/app/api/posts/route");
    const { POST: insertLink } = await import(
      "@/app/api/posts/[id]/insert-external-link/route"
    );

    const linkRes = await createLink(
      jsonRequest("http://localhost/api/external-links", {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({
          labelFr: `${LINK_P} insert`,
          labelEn: "Insert EN",
          url: "https://example.com/insert",
        }),
      })
    );
    const link = await linkRes.json();
    linkId = link.id;

    const postSlug = uniqueSlug(`${POST_P}-insert`);
    const postRes = await createPost(
      jsonRequest("http://localhost/api/posts", {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({ titleFr: postSlug, titleEn: "Insert EN post" }),
      })
    );
    const post = await postRes.json();
    postId = post.id;

    const insertRes = await insertLink(
      jsonRequest(`http://localhost/api/posts/${postId}/insert-external-link`, {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({ linkId: link.id, lang: "en", position: "end" }),
      }),
      { params: Promise.resolve({ id: postId }) }
    );
    expect(insertRes.status).toBe(200);
    const result = await insertRes.json();
    expect(result.inserted.placeholder).toBe(externalLinkPlaceholder(link.id));
    expect(result.post.bodyEn).toContain(externalLinkPlaceholder(link.id));
    expect(result.post.bodyFr).not.toContain(externalLinkPlaceholder(link.id));
  });
});
