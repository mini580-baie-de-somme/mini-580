import { slugify } from "@/lib/utils";
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
    const ignoredClientSlug = uniqueSlug(MILE_P);

    const createRes = await POST(
      jsonRequest("http://localhost/api/milestones", {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({
          slug: ignoredClientSlug,
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
    expect(m.slug).toBe("keel-laying");
    expect(m.slug).not.toBe(ignoredClientSlug);

    const { PATCH, DELETE } = await import("@/app/api/milestones/[id]/route");
    const ctx = { params: Promise.resolve({ id: m.id }) };

    const patchTitleEn = `Keel set ${uniqueSlug(MILE_P)}`;
    const patchRes = await PATCH(
      jsonRequest(`http://localhost/api/milestones/${m.id}`, {
        method: "PATCH",
        headers: bearerHeaders(),
        body: JSON.stringify({
          titleEn: patchTitleEn,
          descriptionEn: "Updated EN",
        }),
      }),
      ctx
    );
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.titleEn).toBe(patchTitleEn);
    expect(patched.descriptionEn).toBe("Updated EN");
    expect(patched.slug).toBe(slugify(patchTitleEn));
    expect(patched.sortOrder).toBeUndefined();

    // Same date → alphabetical by title in the requested locale.
    const sameDay = "2026-07-18T00:00:00.000Z";
    const sortPrefix = uniqueSlug(`${MILE_P}-sort`);
    const zuluFr = `Zulu FR ${sortPrefix}`;
    const alphaFr = `Alpha FR ${sortPrefix}`;
    const alphaEn = `Alpha EN ${sortPrefix}`;
    const zuluEn = `Zulu EN ${sortPrefix}`;
    await POST(
      jsonRequest("http://localhost/api/milestones", {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({
          titleFr: zuluFr,
          titleEn: alphaEn,
          milestoneDate: sameDay,
        }),
      })
    );
    await POST(
      jsonRequest("http://localhost/api/milestones", {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({
          titleFr: alphaFr,
          titleEn: zuluEn,
          milestoneDate: sameDay,
        }),
      })
    );

    const listFr = await GET(
      jsonRequest("http://localhost/api/milestones", {
        searchParams: { locale: "fr", q: sortPrefix },
      })
    );
    const listFrBody = await listFr.json();
    const frItems = (Array.isArray(listFrBody)
      ? listFrBody
      : listFrBody.items) as { slug: string; titleFr: string }[];
    expect(frItems.map((x) => x.titleFr)).toEqual([alphaFr, zuluFr]);

    const listEn = await GET(
      jsonRequest("http://localhost/api/milestones", {
        searchParams: { locale: "en", q: sortPrefix },
      })
    );
    const listEnBody = await listEn.json();
    const enItems = (Array.isArray(listEnBody)
      ? listEnBody
      : listEnBody.items) as { slug: string; titleEn: string }[];
    expect(enItems.map((x) => x.titleEn)).toEqual([alphaEn, zuluEn]);

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

  it("rejects milestone endDate before start date", async () => {
    const { POST } = await import("@/app/api/milestones/route");
    const res = await POST(
      jsonRequest("http://localhost/api/milestones", {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({
          slug: uniqueSlug(`${MILE_P}-bad-end`),
          titleFr: "Bad end",
          titleEn: "Bad end",
          milestoneDate: "2026-05-10T00:00:00.000Z",
          endDate: "2026-05-01T00:00:00.000Z",
        }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("creates milestone with endDate and workloadForecast", async () => {
    const { POST } = await import("@/app/api/milestones/route");
    const slug = uniqueSlug(`${MILE_P}-period`);
    const res = await POST(
      jsonRequest("http://localhost/api/milestones", {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({
          slug,
          titleFr: "Période",
          titleEn: "Period",
          milestoneDate: "2026-04-01T00:00:00.000Z",
          endDate: "2026-04-30T00:00:00.000Z",
          workloadForecast: 12,
        }),
      })
    );
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created.endDate).toBeTruthy();
    expect(created.workloadForecast).toBe(12);

    const { DELETE } = await import("@/app/api/milestones/[id]/route");
    const del = await DELETE(
      jsonRequest(`http://localhost/api/milestones/${created.id}`, {
        method: "DELETE",
        headers: bearerHeaders(),
      }),
      { params: Promise.resolve({ id: created.id }) }
    );
    expect(del.status).toBe(200);
  });
});
