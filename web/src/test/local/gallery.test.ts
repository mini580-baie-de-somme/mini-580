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
            titleFr: `${uniqueSlug(PREFIX)} Publié ${searchToken}`,
            titleEn: `Published ${searchToken}`,
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
            titleFr: `${uniqueSlug(PREFIX)} Brouillon ${searchToken}`,
            titleEn: `Draft ${searchToken}`,
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
    expect(body.items).toHaveLength(1);
    expect(body.photos[0].post.id).toBe(publishedId);
    expect(body.photos[0].kind).toBe("IMAGE");
    expect(body.photos[0].displayUrl).toBeTruthy();
    expect(body.photos[0].thumbUrl).toBeTruthy();
  });

  it("filters gallery by kind=IMAGE and excludes DOCUMENT when filtered", async () => {
    const { POST: createMedia } = await import("@/app/api/media-library/route");
    const { POST: attach } = await import("@/app/api/posts/[id]/media/route");
    const { makeTestPdf } = await import("../helpers");

    const pdf = makeTestPdf(searchToken);
    const form = new FormData();
    form.append(
      "file",
      new File([pdf], `${searchToken}.pdf`, { type: "application/pdf" })
    );
    form.append("titleFr", `Doc ${searchToken}`);
    const media = await (
      await createMedia(
        new (await import("next/server")).NextRequest(
          "http://localhost/api/media-library",
          {
            method: "POST",
            headers: { Authorization: `Bearer ${process.env.INGEST_API_KEY}` },
            body: form,
          }
        )
      )
    ).json();

    await attach(
      jsonRequest(`http://localhost/api/posts/${publishedId}/media`, {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({ mediaIds: [media.id] }),
      }),
      { params: Promise.resolve({ id: publishedId }) }
    );

    const { GET } = await import("@/app/api/gallery/route");
    const imagesOnly = await GET(
      jsonRequest("http://localhost/api/gallery", {
        searchParams: { search: searchToken, kind: "IMAGE" },
      })
    );
    const imgBody = await imagesOnly.json();
    expect(imgBody.photos.every((p: { kind: string }) => p.kind === "IMAGE")).toBe(
      true
    );
    expect(imgBody.photos.some((p: { id: string }) => p.id === media.id)).toBe(
      false
    );

    const docsOnly = await GET(
      jsonRequest("http://localhost/api/gallery", {
        searchParams: { search: searchToken, kind: "DOCUMENT" },
      })
    );
    const docBody = await docsOnly.json();
    expect(docBody.count).toBeGreaterThanOrEqual(1);
    expect(docBody.photos.some((p: { id: string }) => p.id === media.id)).toBe(
      true
    );
    expect(docBody.photos[0].kind).toBe("DOCUMENT");
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
