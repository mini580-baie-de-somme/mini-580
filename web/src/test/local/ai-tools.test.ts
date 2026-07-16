import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import {
  AI_TOOLS,
  aiToolsByCategory,
  resolveToolPath,
} from "@/lib/ai-tools";
import {
  bearerHeaders,
  cleanupBySlug,
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

const PREFIX = "it-ai-";

describe("API integration — IA tools full capacity (Bearer)", () => {
  let postId: string;
  let imageId: string;
  let tagId: string;
  let themeId: string;
  let milestoneId: string;

  beforeAll(async () => {
    await ensureAdminUser();
    await cleanupTestPosts(PREFIX);
    await cleanupBySlug("tag", PREFIX);
    await cleanupBySlug("theme", PREFIX);
    await cleanupBySlug("milestone", PREFIX);
    await resetMediaRoot();
  });

  afterAll(async () => {
    await cleanupTestPosts(PREFIX);
    await cleanupBySlug("tag", PREFIX);
    await cleanupBySlug("theme", PREFIX);
    await cleanupBySlug("milestone", PREFIX);
  });

  it("registry covers all required categories", () => {
    const cats = new Set(AI_TOOLS.map((t) => t.category));
    for (const c of [
      "posts",
      "photos",
      "tags",
      "themes",
      "milestones",
      "sync",
      "translate",
    ] as const) {
      expect(cats.has(c)).toBe(true);
      expect(aiToolsByCategory(c).length).toBeGreaterThan(0);
    }
    expect(AI_TOOLS.length).toBeGreaterThanOrEqual(25);
  });

  it("exercises CRUD tools: posts + trad fields", async () => {
    const { POST } = await import("@/app/api/posts/route");
    const path = resolveToolPath("/api/posts", {});
    const res = await POST(
      jsonRequest(`http://localhost${path}`, {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({
          titleFr: "IA Article FR",
          titleEn: "AI Article EN",
          excerptFr: "Ex FR",
          excerptEn: "Ex EN",
          bodyFr: "Corps FR assisté",
          bodyEn: "EN body assisted",
          slug: uniqueSlug(PREFIX),
        }),
      })
    );
    expect(res.status).toBe(201);
    const post = await res.json();
    postId = post.id;

    const { PATCH } = await import("@/app/api/posts/[id]/route");
    const patchPath = resolveToolPath("/api/posts/:id", { id: postId });
    const patch = await PATCH(
      jsonRequest(`http://localhost${patchPath}`, {
        method: "PATCH",
        headers: bearerHeaders(),
        body: JSON.stringify({ titleEn: "AI Article EN v2" }),
      }),
      { params: Promise.resolve({ id: postId }) }
    );
    expect(patch.status).toBe(200);
    expect((await patch.json()).titleEn).toBe("AI Article EN v2");
  });

  it("exercises photo tools: upload 4 sizes + transform + FR/EN", async () => {
    const { POST } = await import("@/app/api/posts/[id]/images/route");
    const jpeg = await makeTestJpeg();
    const form = new FormData();
    form.append("file", new File([jpeg], "ai.jpg", { type: "image/jpeg" }));
    const upload = await POST(
      new (await import("next/server")).NextRequest(
        `http://localhost${resolveToolPath("/api/posts/:id/images", { id: postId })}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.INGEST_API_KEY}` },
          body: form,
        }
      ),
      { params: Promise.resolve({ id: postId }) }
    );
    expect(upload.status).toBe(201);
    const image = await upload.json();
    imageId = image.id;
    expect(image.urlPicto && image.urlPetite && image.urlMoyenne && image.urlGrande).toBeTruthy();

    const { PATCH } = await import(
      "@/app/api/posts/[id]/images/[imageId]/route"
    );
    const patched = await PATCH(
      jsonRequest(
        `http://localhost${resolveToolPath("/api/posts/:id/images/:imageId", {
          id: postId,
          imageId,
        })}`,
        {
          method: "PATCH",
          headers: bearerHeaders(),
          body: JSON.stringify({
            titleFr: "IA Photo",
            titleEn: "AI Photo",
            zoom: 1.2,
            rotation: 180,
            focusX: 0.4,
            cropW: 0.9,
          }),
        }
      ),
      { params: Promise.resolve({ id: postId, imageId }) }
    );
    expect(patched.status).toBe(200);
  });

  it("exercises tag / theme / milestone tools", async () => {
    const tags = await import("@/app/api/tags/route");
    const tagRes = await tags.POST(
      jsonRequest("http://localhost/api/tags", {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({
          name: uniqueSlug(PREFIX),
          labelFr: "IA Tag",
          labelEn: "AI Tag",
        }),
      })
    );
    expect(tagRes.status).toBe(201);
    tagId = (await tagRes.json()).id;

    const themes = await import("@/app/api/themes/route");
    const themeRes = await themes.POST(
      jsonRequest("http://localhost/api/themes", {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({
          slug: uniqueSlug(PREFIX),
          labelFr: "IA Thème",
          labelEn: "AI Theme",
        }),
      })
    );
    expect(themeRes.status).toBe(201);
    themeId = (await themeRes.json()).id;

    const miles = await import("@/app/api/milestones/route");
    const mileRes = await miles.POST(
      jsonRequest("http://localhost/api/milestones", {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({
          slug: uniqueSlug(PREFIX),
          titleFr: "IA Jalon",
          titleEn: "AI Milestone",
          milestoneDate: "2026-06-01T00:00:00.000Z",
        }),
      })
    );
    expect(mileRes.status).toBe(201);
    milestoneId = (await mileRes.json()).id;

    // Link relations on post (assisted CRUD)
    const { PATCH } = await import("@/app/api/posts/[id]/route");
    const linked = await PATCH(
      jsonRequest(`http://localhost/api/posts/${postId}`, {
        method: "PATCH",
        headers: bearerHeaders(),
        body: JSON.stringify({
          tagIds: [tagId],
          themeIds: [themeId],
          milestoneIds: [milestoneId],
        }),
      }),
      { params: Promise.resolve({ id: postId }) }
    );
    expect(linked.status).toBe(200);
    const full = await linked.json();
    expect(full.tags?.length ?? full.tags).toBeTruthy();
  });

  it("lists sync + translate tools as agent-callable surface", () => {
    const syncTools = aiToolsByCategory("sync").map((t) => t.name);
    expect(syncTools).toContain("sync.pull_from_prod");
    expect(syncTools).toContain("sync.publish_to_prod");
    expect(syncTools).toContain("sync.publish_milestone_to_prod");
    expect(aiToolsByCategory("translate").some((t) => t.name === "translate")).toBe(
      true
    );
  });
});
