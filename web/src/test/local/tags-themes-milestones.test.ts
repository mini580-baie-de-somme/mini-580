import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import {
  bearerHeaders,
  cleanupBySlug,
  ensureAdminUser,
  jsonRequest,
  uniqueSlug,
} from "../helpers";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

const TAG_P = "it-tag-";
const THEME_P = "it-theme-";
const MILE_P = "it-mile-";

describe("API integration — Tags / Themes / Jalons CRUD FR/EN", () => {
  beforeAll(async () => {
    await ensureAdminUser();
    await cleanupBySlug("tag", TAG_P);
    await cleanupBySlug("theme", THEME_P);
    await cleanupBySlug("milestone", MILE_P);
  });

  afterAll(async () => {
    await cleanupBySlug("tag", TAG_P);
    await cleanupBySlug("theme", THEME_P);
    await cleanupBySlug("milestone", MILE_P);
  });

  it("CRUD tags with Bearer", async () => {
    const { POST, GET } = await import("@/app/api/tags/route");
    const name = uniqueSlug(TAG_P);

    const createRes = await POST(
      jsonRequest("http://localhost/api/tags", {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({
          name,
          labelFr: "Électronique",
          labelEn: "Electronics",
        }),
      })
    );
    expect(createRes.status).toBe(201);
    const tag = await createRes.json();
    expect(tag.labelFr).toBe("Électronique");
    expect(tag.labelEn).toBe("Electronics");

    const { PATCH, DELETE, GET: getOne } = await import(
      "@/app/api/tags/[id]/route"
    );
    const ctx = { params: Promise.resolve({ id: tag.id }) };

    const patchRes = await PATCH(
      jsonRequest(`http://localhost/api/tags/${tag.id}`, {
        method: "PATCH",
        headers: bearerHeaders(),
        body: JSON.stringify({ labelEn: "Nav electronics" }),
      }),
      ctx
    );
    expect(patchRes.status).toBe(200);
    expect((await patchRes.json()).labelEn).toBe("Nav electronics");

    const list = await GET(jsonRequest("http://localhost/api/tags"));
    expect(list.status).toBe(200);
    expect((await list.json()).some((t: { id: string }) => t.id === tag.id)).toBe(
      true
    );

    const page = await GET(
      jsonRequest("http://localhost/api/tags", {
        searchParams: { q: "Électronique", limit: "10", offset: "0" },
      })
    );
    expect(page.status).toBe(200);
    const pageBody = (await page.json()) as {
      items: { id: string }[];
      total: number;
      totalAll: number;
    };
    expect(pageBody.total).toBeGreaterThanOrEqual(1);
    expect(pageBody.totalAll).toBeGreaterThanOrEqual(pageBody.total);
    expect(pageBody.items.some((t) => t.id === tag.id)).toBe(true);

    const del = await DELETE(
      jsonRequest(`http://localhost/api/tags/${tag.id}`, {
        method: "DELETE",
        headers: bearerHeaders(),
      }),
      ctx
    );
    expect(del.status).toBe(200);
    expect((await getOne(jsonRequest(`http://localhost/api/tags/${tag.id}`), ctx)).status).toBe(
      404
    );
  });

  it("CRUD themes with Bearer", async () => {
    const { POST, GET } = await import("@/app/api/themes/route");
    const slug = uniqueSlug(THEME_P);

    const createRes = await POST(
      jsonRequest("http://localhost/api/themes", {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({
          slug,
          labelFr: "Construction",
          labelEn: "Building",
        }),
      })
    );
    expect(createRes.status).toBe(201);
    const theme = await createRes.json();
    expect(theme.labelFr).toBe("Construction");
    expect(theme.labelEn).toBe("Building");

    const { PATCH, DELETE } = await import("@/app/api/themes/[id]/route");
    const ctx = { params: Promise.resolve({ id: theme.id }) };

    const patchRes = await PATCH(
      jsonRequest(`http://localhost/api/themes/${theme.id}`, {
        method: "PATCH",
        headers: bearerHeaders(),
        body: JSON.stringify({ labelFr: "Chantier" }),
      }),
      ctx
    );
    expect(patchRes.status).toBe(200);
    expect((await patchRes.json()).labelFr).toBe("Chantier");

    const list = await GET(jsonRequest("http://localhost/api/themes"));
    expect((await list.json()).some((t: { id: string }) => t.id === theme.id)).toBe(
      true
    );

    const del = await DELETE(
      jsonRequest(`http://localhost/api/themes/${theme.id}`, {
        method: "DELETE",
        headers: bearerHeaders(),
      }),
      ctx
    );
    expect(del.status).toBe(200);
  });

  it("CRUD jalons (milestones) with Bearer", async () => {
    const { POST, GET } = await import("@/app/api/milestones/route");
    const slug = uniqueSlug(MILE_P);

    const createRes = await POST(
      jsonRequest("http://localhost/api/milestones", {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({
          slug,
          titleFr: "Pose quille",
          titleEn: "Keel laying",
          descriptionFr: "Desc FR",
          descriptionEn: "Desc EN",
          milestoneDate: "2026-03-15T00:00:00.000Z",
        }),
      })
    );
    expect(createRes.status).toBe(201);
    const m = await createRes.json();
    expect(m.titleFr).toBe("Pose quille");
    expect(m.titleEn).toBe("Keel laying");

    const { PATCH, DELETE } = await import("@/app/api/milestones/[id]/route");
    const ctx = { params: Promise.resolve({ id: m.id }) };

    const patchRes = await PATCH(
      jsonRequest(`http://localhost/api/milestones/${m.id}`, {
        method: "PATCH",
        headers: bearerHeaders(),
        body: JSON.stringify({
          titleEn: "Keel set",
          descriptionEn: "Updated EN",
        }),
      }),
      ctx
    );
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.titleEn).toBe("Keel set");
    expect(patched.descriptionEn).toBe("Updated EN");
    expect(patched.sortOrder).toBeUndefined();

    // Same date → alphabetical by title in the requested locale.
    const sameDay = "2026-07-18T00:00:00.000Z";
    const aSlug = uniqueSlug(`${MILE_P}-a`);
    const zSlug = uniqueSlug(`${MILE_P}-z`);
    await POST(
      jsonRequest("http://localhost/api/milestones", {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({
          slug: zSlug,
          titleFr: "Zulu FR",
          titleEn: "Alpha EN",
          milestoneDate: sameDay,
        }),
      })
    );
    await POST(
      jsonRequest("http://localhost/api/milestones", {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({
          slug: aSlug,
          titleFr: "Alpha FR",
          titleEn: "Zulu EN",
          milestoneDate: sameDay,
        }),
      })
    );

    const listFr = await GET(
      jsonRequest("http://localhost/api/milestones", {
        searchParams: { locale: "fr" },
      })
    );
    const frItems = (await listFr.json()) as { slug: string; titleFr: string }[];
    const frSameDay = frItems.filter((x) =>
      [aSlug, zSlug].includes(x.slug)
    );
    expect(frSameDay.map((x) => x.titleFr)).toEqual(["Alpha FR", "Zulu FR"]);

    const listEn = await GET(
      jsonRequest("http://localhost/api/milestones", {
        searchParams: { locale: "en" },
      })
    );
    const enItems = (await listEn.json()) as { slug: string; titleEn: string }[];
    const enSameDay = enItems.filter((x) =>
      [aSlug, zSlug].includes(x.slug)
    );
    expect(enSameDay.map((x) => x.titleEn)).toEqual(["Alpha EN", "Zulu EN"]);

    const list = await GET(jsonRequest("http://localhost/api/milestones"));
    expect((await list.json()).some((x: { id: string }) => x.id === m.id)).toBe(
      true
    );

    const del = await DELETE(
      jsonRequest(`http://localhost/api/milestones/${m.id}`, {
        method: "DELETE",
        headers: bearerHeaders(),
      }),
      ctx
    );
    expect(del.status).toBe(200);
  });
});
