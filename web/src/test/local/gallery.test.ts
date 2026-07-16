import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import {
  bearerHeaders,
  cleanupTestPosts,
  ensureAdminUser,
  jsonRequest,
  makeTestJpeg,
  resetMediaRoot,
  uniqueSlug,
} from "../helpers";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

const PREFIX = "it-gallery-";

describe("API integration — public gallery", () => {
  let publishedId: string;
  let draftId: string;
  const searchToken = `galsearch-${Date.now().toString(36)}`;

  beforeAll(async () => {
    await ensureAdminUser();
    await cleanupTestPosts(PREFIX);
    await resetMediaRoot();

    const { POST: createPost } = await import("@/app/api/posts/route");
    const published = await (
      await createPost(
        jsonRequest("http://localhost/api/posts", {
          method: "POST",
          headers: bearerHeaders(),
          body: JSON.stringify({
            titleFr: `Publié ${searchToken}`,
            titleEn: `Published ${searchToken}`,
            slug: uniqueSlug(PREFIX),
          }),
        })
      )
    ).json();
    publishedId = published.id;

    const draft = await (
      await createPost(
        jsonRequest("http://localhost/api/posts", {
          method: "POST",
          headers: bearerHeaders(),
          body: JSON.stringify({
            titleFr: `Brouillon ${searchToken}`,
            titleEn: `Draft ${searchToken}`,
            slug: uniqueSlug(PREFIX),
          }),
        })
      )
    ).json();
    draftId = draft.id;

    const { POST: addImage } = await import("@/app/api/posts/[id]/images/route");
    const jpeg = await makeTestJpeg();
    for (const postId of [publishedId, draftId]) {
      const form = new FormData();
      form.append(
        "file",
        new File([jpeg], "yard.jpg", { type: "image/jpeg" })
      );
      form.append("titleFr", `Photo ${searchToken}`);
      form.append("descriptionFr", "Chantier");
      const res = await addImage(
        new (await import("next/server")).NextRequest(
          `http://localhost/api/posts/${postId}/images`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.INGEST_API_KEY}`,
            },
            body: form,
          }
        ),
        { params: Promise.resolve({ id: postId }) }
      );
      expect(res.status).toBe(201);
    }

    const { POST: publish } = await import(
      "@/app/api/posts/[id]/publish/route"
    );
    const pubRes = await publish(
      jsonRequest(`http://localhost/api/posts/${publishedId}/publish`, {
        method: "POST",
        headers: bearerHeaders(),
      }),
      { params: Promise.resolve({ id: publishedId }) }
    );
    expect(pubRes.status).toBe(200);
  });

  afterAll(async () => {
    await cleanupTestPosts(PREFIX);
  });

  it("lists only published post photos", async () => {
    const { GET } = await import("@/app/api/gallery/route");
    const res = await GET(
      jsonRequest("http://localhost/api/gallery", {
        searchParams: { search: searchToken },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(1);
    expect(body.photos).toHaveLength(1);
    expect(body.photos[0].post.id).toBe(publishedId);
    expect(body.photos[0].displayUrl).toBeTruthy();
    expect(body.photos[0].thumbUrl).toBeTruthy();
  });

  it("returns empty for unknown search", async () => {
    const { GET } = await import("@/app/api/gallery/route");
    const res = await GET(
      jsonRequest("http://localhost/api/gallery", {
        searchParams: { search: "zzznomatch-gallery-xyz" },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(0);
    expect(body.photos).toEqual([]);
  });
});
