import { access } from "node:fs/promises";
import { resolve } from "node:path";
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
import { mediaKeyFromUrl } from "@/lib/media-bucket";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

const PREFIX = "it-photo-";

async function mediaExists(url: string | null | undefined) {
  if (!url) return false;
  const key = mediaKeyFromUrl(url);
  if (!key) return false;
  const root = process.env.MEDIA_ROOT || resolve(process.cwd(), "data/media-it");
  try {
    await access(resolve(root, key));
    return true;
  } catch {
    return false;
  }
}

describe("API integration — Photos CRUD + transforms + 4 sizes", () => {
  let postId: string;

  beforeAll(async () => {
    await ensureAdminUser();
    await cleanupTestPosts(PREFIX);
    await resetMediaRoot();

    const { POST } = await import("@/app/api/posts/route");
    const res = await POST(
      jsonRequest("http://localhost/api/posts", {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({
          titleFr: "Photos FR",
          titleEn: "Photos EN",
          slug: uniqueSlug(PREFIX),
        }),
      })
    );
    const post = await res.json();
    postId = post.id;
  });

  afterAll(async () => {
    await cleanupTestPosts(PREFIX);
  });

  it("uploads multipart image and generates 4 WebP sizes", async () => {
    const { POST } = await import("@/app/api/posts/[id]/images/route");
    const jpeg = await makeTestJpeg();
    const form = new FormData();
    form.append(
      "file",
      new File([jpeg], "coque.jpg", { type: "image/jpeg" })
    );
    form.append("titleFr", "Photo coque");
    form.append("descriptionFr", "Description FR");

    const res = await POST(
      new (await import("next/server")).NextRequest(
        `http://localhost/api/posts/${postId}/images`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.INGEST_API_KEY}` },
          body: form,
        }
      ),
      { params: Promise.resolve({ id: postId }) }
    );
    expect(res.status).toBe(201);
    const image = await res.json();
    expect(image.titleFr).toBe("Photo coque");
    expect(image.descriptionFr).toBe("Description FR");
    expect(image.urlOrigin).toBeTruthy();
    expect(image.urlPicto).toMatch(/picto\.webp$/);
    expect(image.urlPetite).toMatch(/petite\.webp$/);
    expect(image.urlMoyenne).toMatch(/moyenne\.webp$/);
    expect(image.urlGrande).toMatch(/grande\.webp$/);

    expect(await mediaExists(image.urlOrigin)).toBe(true);
    expect(await mediaExists(image.urlPicto)).toBe(true);
    expect(await mediaExists(image.urlPetite)).toBe(true);
    expect(await mediaExists(image.urlMoyenne)).toBe(true);
    expect(await mediaExists(image.urlGrande)).toBe(true);
  });

  it("patches FR/EN meta and move/zoom/rotate/crop transforms, regenerating 4 sizes", async () => {
    const { GET } = await import("@/app/api/posts/[id]/images/route");
    const listRes = await GET(
      jsonRequest(`http://localhost/api/posts/${postId}/images`),
      { params: Promise.resolve({ id: postId }) }
    );
    const images = await listRes.json();
    expect(images.length).toBeGreaterThan(0);
    const imageId = images[0].id as string;
    const beforeMoyenne = images[0].urlMoyenne as string;

    const { PATCH } = await import(
      "@/app/api/posts/[id]/images/[imageId]/route"
    );
    const res = await PATCH(
      jsonRequest(
        `http://localhost/api/posts/${postId}/images/${imageId}`,
        {
          method: "PATCH",
          headers: bearerHeaders(),
          body: JSON.stringify({
            titleFr: "Titre photo FR",
            titleEn: "Photo title EN",
            descriptionFr: "Légende FR",
            descriptionEn: "Caption EN",
            focusX: 0.3,
            focusY: 0.7,
            zoom: 1.5,
            rotation: 90,
            cropX: 0.1,
            cropY: 0.1,
            cropW: 0.8,
            cropH: 0.8,
          }),
        }
      ),
      { params: Promise.resolve({ id: postId, imageId }) }
    );
    expect(res.status).toBe(200);
    const patched = await res.json();
    expect(patched.titleFr).toBe("Titre photo FR");
    expect(patched.titleEn).toBe("Photo title EN");
    expect(patched.descriptionEn).toBe("Caption EN");
    expect(patched.focusX).toBe(0.3);
    expect(patched.focusY).toBe(0.7);
    expect(patched.zoom).toBe(1.5);
    expect(patched.rotation).toBe(90);
    expect(patched.cropW).toBe(0.8);
    // Spec B: transform bake regenerates the 4 display sizes
    expect(patched.urlMoyenne).not.toBe(beforeMoyenne);
    expect(await mediaExists(patched.urlPicto)).toBe(true);
    expect(await mediaExists(patched.urlPetite)).toBe(true);
    expect(await mediaExists(patched.urlMoyenne)).toBe(true);
    expect(await mediaExists(patched.urlGrande)).toBe(true);
  });

  it("replaces file and regenerates 4 sizes", async () => {
    const { GET } = await import("@/app/api/posts/[id]/images/route");
    const listRes = await GET(
      jsonRequest(`http://localhost/api/posts/${postId}/images`),
      { params: Promise.resolve({ id: postId }) }
    );
    const images = await listRes.json();
    const imageId = images[0].id as string;
    const before = images[0].urlMoyenne as string;

    const { POST } = await import(
      "@/app/api/posts/[id]/images/[imageId]/replace/route"
    );
    const jpeg = await makeTestJpeg();
    const form = new FormData();
    form.append(
      "file",
      new File([jpeg], "replace.jpg", { type: "image/jpeg" })
    );

    const res = await POST(
      new (await import("next/server")).NextRequest(
        `http://localhost/api/posts/${postId}/images/${imageId}/replace`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.INGEST_API_KEY}` },
          body: form,
        }
      ),
      { params: Promise.resolve({ id: postId, imageId }) }
    );
    expect(res.status).toBe(200);
    const replaced = await res.json();
    expect(replaced.urlMoyenne).not.toBe(before);
    expect(await mediaExists(replaced.urlPicto)).toBe(true);
    expect(await mediaExists(replaced.urlPetite)).toBe(true);
    expect(await mediaExists(replaced.urlMoyenne)).toBe(true);
    expect(await mediaExists(replaced.urlGrande)).toBe(true);
  });

  it("reorders and deletes images", async () => {
    const { POST, GET } = await import("@/app/api/posts/[id]/images/route");
    const jpeg = await makeTestJpeg();
    const form = new FormData();
    form.append("file", new File([jpeg], "b.jpg", { type: "image/jpeg" }));
    await POST(
      new (await import("next/server")).NextRequest(
        `http://localhost/api/posts/${postId}/images`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.INGEST_API_KEY}` },
          body: form,
        }
      ),
      { params: Promise.resolve({ id: postId }) }
    );

    const listRes = await GET(
      jsonRequest(`http://localhost/api/posts/${postId}/images`),
      { params: Promise.resolve({ id: postId }) }
    );
    const images = await listRes.json();
    expect(images.length).toBeGreaterThanOrEqual(2);
    const ids = images.map((i: { id: string }) => i.id).reverse();

    const { PUT } = await import(
      "@/app/api/posts/[id]/images/reorder/route"
    );
    const reorderRes = await PUT(
      jsonRequest(`http://localhost/api/posts/${postId}/images/reorder`, {
        method: "PUT",
        headers: bearerHeaders(),
        body: JSON.stringify({ imageIds: ids }),
      }),
      { params: Promise.resolve({ id: postId }) }
    );
    expect(reorderRes.status).toBe(200);

    const { DELETE } = await import(
      "@/app/api/posts/[id]/images/[imageId]/route"
    );
    const delRes = await DELETE(
      jsonRequest(
        `http://localhost/api/posts/${postId}/images/${ids[0]}`,
        {
          method: "DELETE",
          headers: bearerHeaders(),
        }
      ),
      { params: Promise.resolve({ id: postId, imageId: ids[0] }) }
    );
    expect(delRes.status).toBe(204);
  });
});
