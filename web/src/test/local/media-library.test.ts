import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import {
  bearerHeaders,
  cleanupTestPosts,
  ensureAdminUser,
  jsonRequest,
  makeTestJpeg,
  makeTestPdf,
  resetMediaRoot,
  uniqueSlug,
} from "../helpers";
import { prisma } from "@/lib/db";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

const PREFIX = "it-media-";

describe("API integration — Media library", () => {
  let postA: string;
  let postB: string;

  beforeAll(async () => {
    await ensureAdminUser();
    await cleanupTestPosts(PREFIX);
    await resetMediaRoot();

    const { POST: createPost } = await import("@/app/api/posts/route");
    const a = await createPost(
      jsonRequest("http://localhost/api/posts", {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({
          titleFr: uniqueSlug(PREFIX),
          titleEn: "Media A",
        }),
      })
    );
    postA = (await a.json()).id;

    const b = await createPost(
      jsonRequest("http://localhost/api/posts", {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({
          titleFr: uniqueSlug(PREFIX),
          titleEn: "Media B",
        }),
      })
    );
    postB = (await b.json()).id;
  });

  afterAll(async () => {
    await cleanupTestPosts(PREFIX);
  });

  it("creates IMAGE media via JSON and lists with total/totalAll", async () => {
    const { POST: createMedia, GET: listMedia } = await import(
      "@/app/api/media-library/route"
    );
    const mediaRes = await createMedia(
      jsonRequest("http://localhost/api/media-library", {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({
          urlOrigin: "/media/2026/07/lib-origin.jpg",
          urlMoyenne: "/media/2026/07/lib-moyenne.webp",
          titleFr: "Lib photo FR",
          titleEn: "Lib photo EN",
          kind: "IMAGE",
          mimeType: "image/jpeg",
        }),
      })
    );
    expect(mediaRes.status).toBe(201);
    const media = await mediaRes.json();
    expect(media.kind).toBe("IMAGE");

    const page = await listMedia(
      jsonRequest("http://localhost/api/media-library", {
        headers: bearerHeaders(),
        searchParams: { q: "Lib photo", limit: "10", offset: "0" },
      })
    );
    const body = (await page.json()) as {
      items: { id: string }[];
      total: number;
      totalAll: number;
    };
    expect(body.total).toBeGreaterThanOrEqual(1);
    expect(body.totalAll).toBeGreaterThanOrEqual(body.total);
    expect(body.items.some((i) => i.id === media.id)).toBe(true);

    await prisma.media.delete({ where: { id: media.id } }).catch(() => null);
  });

  it("lists filtered by kind=DOCUMENT", async () => {
    const { POST: createMedia, GET: listMedia } = await import(
      "@/app/api/media-library/route"
    );
    const doc = await (
      await createMedia(
        jsonRequest("http://localhost/api/media-library", {
          method: "POST",
          headers: bearerHeaders(),
          body: JSON.stringify({
            urlOrigin: "/media/2026/07/kind-filter.pdf",
            titleFr: "Kind filter PDF",
            titleEn: "Kind filter PDF",
            kind: "DOCUMENT",
            mimeType: "application/pdf",
          }),
        })
      )
    ).json();

    const page = await listMedia(
      jsonRequest("http://localhost/api/media-library", {
        headers: bearerHeaders(),
        searchParams: { kind: "DOCUMENT", q: "Kind filter", limit: "20", offset: "0" },
      })
    );
    const body = await page.json();
    expect(body.items.every((i: { kind: string }) => i.kind === "DOCUMENT")).toBe(
      true
    );
    expect(body.items.some((i: { id: string }) => i.id === doc.id)).toBe(true);

    await prisma.media.delete({ where: { id: doc.id } }).catch(() => null);
  });

  it("uploads DOCUMENT (PDF) via multipart without image variants", async () => {
    const { POST: createMedia } = await import("@/app/api/media-library/route");
    const pdf = makeTestPdf("doc-it");
    const form = new FormData();
    form.append("file", new File([pdf], "plan.pdf", { type: "application/pdf" }));
    form.append("titleFr", "Plan PDF");
    form.append("titleEn", "PDF plan");

    const res = await createMedia(
      new (await import("next/server")).NextRequest(
        "http://localhost/api/media-library",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.INGEST_API_KEY}` },
          body: form,
        }
      )
    );
    expect(res.status).toBe(201);
    const media = await res.json();
    expect(media.kind).toBe("DOCUMENT");
    expect(media.mimeType).toBe("application/pdf");
    expect(media.urlOrigin).toMatch(/\.pdf$/i);
    expect(media.urlPicto).toBeNull();
    expect(media.urlMoyenne).toBeNull();

    await prisma.media.delete({ where: { id: media.id } }).catch(() => null);
  });

  it("uploads IMAGE multipart then patches layout (rotation/scale/bg) and rebakes", async () => {
    const { POST: createMedia } = await import("@/app/api/media-library/route");
    const jpeg = await makeTestJpeg();
    const form = new FormData();
    form.append("file", new File([jpeg], "layout.jpg", { type: "image/jpeg" }));
    form.append("titleFr", "Layout FR");

    const createRes = await createMedia(
      new (await import("next/server")).NextRequest(
        "http://localhost/api/media-library",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.INGEST_API_KEY}` },
          body: form,
        }
      )
    );
    expect(createRes.status).toBe(201);
    const media = await createRes.json();
    expect(media.kind).toBe("IMAGE");
    expect(media.urlGrande).toMatch(/grande\.webp$/);
    const before = media.urlMoyenne as string;

    const { PATCH } = await import("@/app/api/media-library/[id]/route");
    const patchRes = await PATCH(
      jsonRequest(`http://localhost/api/media-library/${media.id}`, {
        method: "PATCH",
        headers: bearerHeaders(),
        body: JSON.stringify({
          rotation: 27,
          scaleX: 1.25,
          scaleY: 1.25,
          lockAspect: true,
          offsetX: 0.05,
          cropShape: "CIRCLE",
          backgroundColor: "#c2410c",
          cropInset: 0.1,
        }),
      }),
      { params: Promise.resolve({ id: media.id }) }
    );
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.rotation).toBeCloseTo(27, 5);
    expect(patched.scaleX).toBeCloseTo(1.25, 5);
    expect(patched.cropShape).toBe("CIRCLE");
    expect(patched.backgroundColor).toBe("#c2410c");
    expect(patched.urlMoyenne).not.toBe(before);
    expect(patched.urlOrigin).toBe(media.urlOrigin);

    await prisma.media.delete({ where: { id: media.id } }).catch(() => null);
  });

  it("attaches same media to two posts; detach keeps library item", async () => {
    const { POST: createMedia } = await import("@/app/api/media-library/route");
    const mediaRes = await createMedia(
      jsonRequest("http://localhost/api/media-library", {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({
          urlOrigin: "/media/2026/07/shared.jpg",
          titleFr: "Shared",
          titleEn: "Shared",
          kind: "IMAGE",
        }),
      })
    );
    const media = await mediaRes.json();

    const { POST: attach } = await import("@/app/api/posts/[id]/media/route");
    for (const postId of [postA, postB]) {
      const attachRes = await attach(
        jsonRequest(`http://localhost/api/posts/${postId}/media`, {
          method: "POST",
          headers: bearerHeaders(),
          body: JSON.stringify({ mediaIds: [media.id] }),
        }),
        { params: Promise.resolve({ id: postId }) }
      );
      expect(attachRes.status).toBe(201);
    }

    expect(await prisma.postMedia.count({ where: { mediaId: media.id } })).toBe(
      2
    );

    const { DELETE: detach } = await import(
      "@/app/api/posts/[id]/media/[mediaId]/route"
    );
    const detachRes = await detach(
      jsonRequest(`http://localhost/api/posts/${postA}/media/${media.id}`, {
        method: "DELETE",
        headers: bearerHeaders(),
      }),
      { params: Promise.resolve({ id: postA, mediaId: media.id }) }
    );
    expect(detachRes.status).toBe(200);
    expect(
      await prisma.postMedia.count({ where: { mediaId: media.id } })
    ).toBe(1);
    expect(await prisma.media.findUnique({ where: { id: media.id } })).toBeTruthy();

    await prisma.postMedia.deleteMany({ where: { mediaId: media.id } });
    await prisma.media.delete({ where: { id: media.id } }).catch(() => null);
  });

  it("refuses delete when linked unless force=1", async () => {
    const { POST: createMedia } = await import("@/app/api/media-library/route");
    const media = await (
      await createMedia(
        jsonRequest("http://localhost/api/media-library", {
          method: "POST",
          headers: bearerHeaders(),
          body: JSON.stringify({
            urlOrigin: "/media/2026/07/force-del.jpg",
            titleFr: "Force del",
            titleEn: "Force del",
            kind: "IMAGE",
          }),
        })
      )
    ).json();

    const { POST: attach } = await import("@/app/api/posts/[id]/media/route");
    await attach(
      jsonRequest(`http://localhost/api/posts/${postA}/media`, {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({ mediaIds: [media.id] }),
      }),
      { params: Promise.resolve({ id: postA }) }
    );

    const { DELETE: del } = await import("@/app/api/media-library/[id]/route");
    const blocked = await del(
      jsonRequest(`http://localhost/api/media-library/${media.id}`, {
        method: "DELETE",
        headers: bearerHeaders(),
      }),
      { params: Promise.resolve({ id: media.id }) }
    );
    expect(blocked.status).toBe(409);

    const forced = await del(
      jsonRequest(`http://localhost/api/media-library/${media.id}?force=1`, {
        method: "DELETE",
        headers: bearerHeaders(),
      }),
      { params: Promise.resolve({ id: media.id }) }
    );
    expect(forced.status).toBe(200);
    expect(await prisma.media.findUnique({ where: { id: media.id } })).toBeNull();
    expect(
      await prisma.postMedia.count({ where: { mediaId: media.id } })
    ).toBe(0);
  });

  it("sets cover via PostMedia and updates coverImageUrl", async () => {
    const { POST: createMedia } = await import("@/app/api/media-library/route");
    const jpeg = await makeTestJpeg();
    const form = new FormData();
    form.append("file", new File([jpeg], "cover.jpg", { type: "image/jpeg" }));
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

    const { POST: attach } = await import("@/app/api/posts/[id]/media/route");
    await attach(
      jsonRequest(`http://localhost/api/posts/${postA}/media`, {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({ mediaIds: [media.id] }),
      }),
      { params: Promise.resolve({ id: postA }) }
    );

    const { POST: setCover } = await import(
      "@/app/api/posts/[id]/media/[mediaId]/cover/route"
    );
    const coverRes = await setCover(
      jsonRequest(
        `http://localhost/api/posts/${postA}/media/${media.id}/cover`,
        { method: "POST", headers: bearerHeaders() }
      ),
      { params: Promise.resolve({ id: postA, mediaId: media.id }) }
    );
    expect(coverRes.status).toBe(200);

    const link = await prisma.postMedia.findUnique({
      where: { postId_mediaId: { postId: postA, mediaId: media.id } },
    });
    expect(link?.isCover).toBe(true);
    const post = await prisma.post.findUnique({ where: { id: postA } });
    expect(post?.coverImageUrl).toBeTruthy();

    await prisma.postMedia.deleteMany({ where: { mediaId: media.id } });
    await prisma.media.delete({ where: { id: media.id } }).catch(() => null);
  });

  it("reorders via /media and remains compatible with /images list", async () => {
    const { POST: attachOrUpload } = await import(
      "@/app/api/posts/[id]/media/route"
    );
    const jpeg = await makeTestJpeg();
    const ids: string[] = [];
    for (const name of ["r1.jpg", "r2.jpg"]) {
      const form = new FormData();
      form.append("file", new File([jpeg], name, { type: "image/jpeg" }));
      const res = await attachOrUpload(
        new (await import("next/server")).NextRequest(
          `http://localhost/api/posts/${postB}/media`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${process.env.INGEST_API_KEY}` },
            body: form,
          }
        ),
        { params: Promise.resolve({ id: postB }) }
      );
      expect(res.status).toBe(201);
      ids.push((await res.json()).id);
    }

    const { PUT: reorder } = await import(
      "@/app/api/posts/[id]/media/reorder/route"
    );
    const reordered = [...ids].reverse();
    const reorderRes = await reorder(
      jsonRequest(`http://localhost/api/posts/${postB}/media/reorder`, {
        method: "PUT",
        headers: bearerHeaders(),
        body: JSON.stringify({ mediaIds: reordered }),
      }),
      { params: Promise.resolve({ id: postB }) }
    );
    expect(reorderRes.status).toBe(200);
    const ordered = await reorderRes.json();
    expect(ordered.map((m: { id: string }) => m.id)).toEqual(reordered);

    const { GET: imagesCompat } = await import(
      "@/app/api/posts/[id]/images/route"
    );
    const compat = await imagesCompat(
      jsonRequest(`http://localhost/api/posts/${postB}/images`),
      { params: Promise.resolve({ id: postB }) }
    );
    const compatBody = await compat.json();
    expect(compatBody.map((m: { id: string }) => m.id)).toEqual(reordered);

    for (const id of ids) {
      await prisma.postMedia.deleteMany({ where: { mediaId: id } });
      await prisma.media.delete({ where: { id } }).catch(() => null);
    }
  });

  it("GET /api/posts/:id returns legacy images from mediaLinks", async () => {
    const { POST: createMedia } = await import("@/app/api/media-library/route");
    const media = await (
      await createMedia(
        jsonRequest("http://localhost/api/media-library", {
          method: "POST",
          headers: bearerHeaders(),
          body: JSON.stringify({
            urlOrigin: "/media/2026/07/legacy-shape.jpg",
            titleFr: "Legacy shape",
            titleEn: "Legacy shape",
            kind: "IMAGE",
          }),
        })
      )
    ).json();

    const { POST: attach } = await import("@/app/api/posts/[id]/media/route");
    await attach(
      jsonRequest(`http://localhost/api/posts/${postA}/media`, {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({ mediaIds: [media.id] }),
      }),
      { params: Promise.resolve({ id: postA }) }
    );

    const { GET } = await import("@/app/api/posts/[id]/route");
    const res = await GET(
      jsonRequest(`http://localhost/api/posts/${postA}`, {
        headers: bearerHeaders(),
      }),
      { params: Promise.resolve({ id: postA }) }
    );
    expect(res.status).toBe(200);
    const post = await res.json();
    expect(Array.isArray(post.images)).toBe(true);
    expect(post.images.some((i: { id: string }) => i.id === media.id)).toBe(
      true
    );
    expect(post.mediaLinks?.length).toBeGreaterThanOrEqual(1);

    await prisma.postMedia.deleteMany({ where: { mediaId: media.id } });
    await prisma.media.delete({ where: { id: media.id } }).catch(() => null);
  });
});
