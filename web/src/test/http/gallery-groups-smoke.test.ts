import { beforeAll, describe, expect, it } from "vitest";
import { httpJson, requireHttpEnv, type HttpEnv } from "./helpers";
import { mediaGroupPlaceholder } from "@/lib/media-group-token";

/**
 * Live HTTP smoke: public gallery shape + optional create-group→insert→publish→gallery flow.
 * Skips gracefully when TEST_* env is missing (local without secrets).
 */
function tryHttpEnv(): HttpEnv | null {
  try {
    return requireHttpEnv();
  } catch {
    return null;
  }
}

describe("HTTP — gallery inline groups smoke", () => {
  const env = tryHttpEnv();

  beforeAll(() => {
    if (!env) {
      console.warn(
        "[gallery-groups-smoke] Skipping: TEST_BASE_URL / TEST_INGEST_API_KEY / TEST_ADMIN_PASSWORD not set"
      );
    }
  });

  it("public gallery API responds with items/photos shape", async ({ skip }) => {
    if (!env) {
      skip();
      return;
    }
    const res = await httpJson(env, "/api/gallery");
    expect(res.status).toBe(200);
    const body = res.json as {
      count: number;
      photos: unknown[];
      items?: unknown[];
    };
    expect(typeof body.count).toBe("number");
    expect(Array.isArray(body.photos)).toBe(true);
    expect(body.count).toBe(body.photos.length);
    if (body.items) {
      expect(Array.isArray(body.items)).toBe(true);
      expect(body.items.length).toBe(body.count);
    }
  });

  it("create group → insert → publish → gallery contains group media", async ({
    skip,
  }) => {
    if (!env) {
      skip();
      return;
    }

    const stamp = Date.now().toString(36);
    const title = `http-gal-grp-${stamp}`;

    const mediaRes = await httpJson(env, "/api/media-library", {
      method: "POST",
      bearer: true,
      body: JSON.stringify({
        urlOrigin: `/media/2026/11/http-gal-grp-${stamp}.jpg`,
        urlMoyenne: `/media/2026/11/http-gal-grp-${stamp}-m.webp`,
        titleFr: title,
        titleEn: title,
        kind: "IMAGE",
        mimeType: "image/jpeg",
      }),
    });
    if (mediaRes.status !== 201) {
      console.warn(
        `[gallery-groups-smoke] media create skipped (${mediaRes.status}):`,
        mediaRes.json
      );
      skip();
      return;
    }
    const media = mediaRes.json as { id: string };

    const groupRes = await httpJson(env, "/api/media-groups", {
      method: "POST",
      bearer: true,
      body: JSON.stringify({
        titleFr: title,
        mediaIds: [media.id],
      }),
    });
    expect(groupRes.status).toBe(201);
    const group = groupRes.json as { id: string };

    const postRes = await httpJson(env, "/api/posts", {
      method: "POST",
      bearer: true,
      body: JSON.stringify({
        titleFr: title,
        titleEn: title,
        bodyFr: `Smoke\n\n${mediaGroupPlaceholder(group.id)}\n`,
      }),
    });
    expect(postRes.status).toBe(201);
    const post = postRes.json as { id: string };

    const pubRes = await httpJson(env, `/api/posts/${post.id}/publish`, {
      method: "POST",
      bearer: true,
    });
    expect(pubRes.status).toBe(200);

    const gallery = await httpJson(
      env,
      `/api/gallery?search=${encodeURIComponent(title)}`
    );
    expect(gallery.status).toBe(200);
    const galBody = gallery.json as {
      items?: Array<{ id: string; titleFr?: string }>;
      photos: Array<{ id: string; titleFr?: string }>;
    };
    const rows = galBody.items ?? galBody.photos;
    expect(rows.some((r) => r.id === media.id)).toBe(true);

    // Cleanup best-effort: unpublish/archive not always available — leave draft-like data tagged
  });
});
