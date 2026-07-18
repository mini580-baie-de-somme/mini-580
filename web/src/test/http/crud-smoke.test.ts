import { beforeAll, describe, expect, it } from "vitest";
import {
  httpJson,
  loginSession,
  requireHttpEnv,
  type HttpEnv,
} from "./helpers";

/**
 * Live HTTP checks against the real TEST server.
 * Fails hard if TEST_BASE_URL / credentials are missing (no skip).
 */
describe("HTTP — real TEST server CRUD smoke", () => {
  let env: HttpEnv;
  let cookie: string;
  let postId: string;
  const titleMarker = `http-it-${Date.now().toString(36)}`;

  beforeAll(() => {
    env = requireHttpEnv();
  });

  it("logs in with session cookie", async () => {
    cookie = await loginSession(env);
    expect(cookie).toMatch(/^mini580_session=/);
  });

  it("creates a draft post via Bearer", async () => {
    const res = await httpJson(env, "/api/posts", {
      method: "POST",
      bearer: true,
      body: JSON.stringify({
        titleFr: titleMarker,
        titleEn: "HTTP IT EN",
        bodyFr: "Corps FR",
        bodyEn: "Body EN",
        slug: "client-slug-ignored",
      }),
    });
    expect(res.status).toBe(201);
    const post = res.json as {
      id: string;
      titleFr: string;
      status: string;
      slug: string;
    };
    expect(post.titleFr).toBe(titleMarker);
    expect(post.status).toBe("DRAFT");
    // Slug is auto-generated from titleFr — client slug ignored.
    expect(post.slug).toBe(titleMarker);
    expect(post.slug).not.toBe("client-slug-ignored");
    postId = post.id;
  });

  it("patches FR/EN via Bearer", async () => {
    const res = await httpJson(env, `/api/posts/${postId}`, {
      method: "PATCH",
      bearer: true,
      body: JSON.stringify({ titleEn: "HTTP IT EN updated" }),
    });
    expect(res.status).toBe(200);
    expect((res.json as { titleEn: string }).titleEn).toBe("HTTP IT EN updated");
  });

  it("CRUD milestone via Bearer (date order, no sortOrder)", async () => {
    const mileSlug = `http-mile-${Date.now().toString(36)}`;
    const create = await httpJson(env, "/api/milestones", {
      method: "POST",
      bearer: true,
      body: JSON.stringify({
        slug: mileSlug,
        titleFr: `HTTP Jalon ${mileSlug}`,
        titleEn: `HTTP Mile ${mileSlug}`,
        milestoneDate: "2026-07-18T00:00:00.000Z",
      }),
    });
    expect(create.status).toBe(201);
    const mile = create.json as { id: string; titleFr: string };
    expect(mile.titleFr).toContain("HTTP Jalon");

    const list = await httpJson(env, "/api/milestones?locale=fr");
    expect(list.status).toBe(200);
    expect(Array.isArray(list.json)).toBe(true);

    const del = await httpJson(env, `/api/milestones/${mile.id}`, {
      method: "DELETE",
      bearer: true,
    });
    expect(del.status).toBe(200);
  });

  it("CRUD tag via Bearer", async () => {
    const create = await httpJson(env, "/api/tags", {
      method: "POST",
      bearer: true,
      body: JSON.stringify({
        name: `http-tag-${Date.now().toString(36)}`,
        labelFr: "Tag HTTP",
        labelEn: "HTTP Tag",
      }),
    });
    expect(create.status).toBe(201);
    const tag = create.json as { id: string };
    const del = await httpJson(env, `/api/tags/${tag.id}`, {
      method: "DELETE",
      bearer: true,
    });
    expect(del.status).toBe(200);
  });

  it("deletes the draft post", async () => {
    const res = await httpJson(env, `/api/posts/${postId}`, {
      method: "DELETE",
      bearer: true,
    });
    expect([200, 204]).toContain(res.status);
  });

  it("sync status requires session", async () => {
    const unauth = await httpJson(env, "/api/sync/status");
    expect(unauth.status).toBe(401);
    const auth = await httpJson(env, "/api/sync/status", { cookie });
    // 200 = peer OK; 502 = configured but peer unreachable (still JSON + activeJob)
    expect([200, 502]).toContain(auth.status);
    const body = auth.json as { configured?: boolean; activeJob?: unknown };
    expect(typeof body.configured === "boolean" || "error" in (body as object)).toBeTruthy();
  });
});
