import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { MediaGroupLayout } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { mediaGroupPlaceholder } from "@/lib/media-group-token";
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

const PREFIX = "it-gal-grp-";
const GROUP_P = "it-gal-grp-g";

describe("API integration — gallery includes inline MediaGroup members", () => {
  let publishedId: string;
  let draftId: string;
  let coverMediaId: string;
  let groupOnlyMediaId: string;
  let standaloneMediaId: string;
  let alsoPostMediaId: string;
  let publishedGroupId: string;
  let draftGroupId: string;
  let draftOnlyMediaId: string;
  let unreferencedGroupMediaId: string;
  const searchToken = `galgrp-${Date.now().toString(36)}`;

  beforeAll(async () => {
    await ensureAdminUser();
    await cleanupTestPosts(PREFIX);
    await prisma.mediaGroup.deleteMany({ where: { slug: { startsWith: GROUP_P } } });
    await resetMediaRoot();

    const { POST: createPost } = await import("@/app/api/posts/route");
    const { POST: createMedia } = await import("@/app/api/media-library/route");
    const { POST: createGroup } = await import("@/app/api/media-groups/route");
    const { POST: attach } = await import("@/app/api/posts/[id]/media/route");
    const { PATCH: patchPost } = await import("@/app/api/posts/[id]/route");
    const { POST: publish } = await import("@/app/api/posts/[id]/publish/route");
    const { NextRequest } = await import("next/server");

    async function uploadJpeg(title: string) {
      const jpeg = await makeTestJpeg();
      const form = new FormData();
      form.append("file", new File([jpeg], `${title}.jpg`, { type: "image/jpeg" }));
      form.append("titleFr", title);
      form.append("titleEn", title);
      const res = await createMedia(
        new NextRequest("http://localhost/api/media-library", {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.INGEST_API_KEY}` },
          body: form,
        })
      );
      expect(res.status).toBe(201);
      return (await res.json()) as { id: string };
    }

    const published = await (
      await createPost(
        jsonRequest("http://localhost/api/posts", {
          method: "POST",
          headers: bearerHeaders(),
          body: JSON.stringify({
            titleFr: `${uniqueSlug(PREFIX)} Pub ${searchToken}`,
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
            titleFr: `${uniqueSlug(PREFIX)} Draft ${searchToken}`,
            titleEn: `Draft ${searchToken}`,
          }),
        })
      )
    ).json();
    draftId = draft.id;

    const cover = await uploadJpeg(`Cover ${searchToken}`);
    coverMediaId = cover.id;
    const groupOnly = await uploadJpeg(`GroupOnly ${searchToken}`);
    groupOnlyMediaId = groupOnly.id;
    const standalone = await uploadJpeg(`Standalone ${searchToken}`);
    standaloneMediaId = standalone.id;
    const alsoPm = await uploadJpeg(`AlsoPM ${searchToken}`);
    alsoPostMediaId = alsoPm.id;
    const draftOnly = await uploadJpeg(`DraftOnly ${searchToken}`);
    draftOnlyMediaId = draftOnly.id;
    const unref = await uploadJpeg(`UnrefGroup ${searchToken}`);
    unreferencedGroupMediaId = unref.id;

    await attach(
      jsonRequest(`http://localhost/api/posts/${publishedId}/media`, {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({
          mediaIds: [coverMediaId, standaloneMediaId, alsoPostMediaId],
          setCoverFirst: true,
        }),
      }),
      { params: Promise.resolve({ id: publishedId }) }
    );

    const pubGroup = await (
      await createGroup(
        jsonRequest("http://localhost/api/media-groups", {
          method: "POST",
          headers: bearerHeaders(),
          body: JSON.stringify({
            titleFr: `${GROUP_P}-pub`,
            layout: MediaGroupLayout.GRID,
            mediaIds: [groupOnlyMediaId, alsoPostMediaId],
          }),
        })
      )
    ).json();
    publishedGroupId = pubGroup.id;

    const draftGroup = await (
      await createGroup(
        jsonRequest("http://localhost/api/media-groups", {
          method: "POST",
          headers: bearerHeaders(),
          body: JSON.stringify({
            titleFr: `${GROUP_P}-draft`,
            layout: MediaGroupLayout.GRID,
            mediaIds: [draftOnlyMediaId],
          }),
        })
      )
    ).json();
    draftGroupId = draftGroup.id;

    await createGroup(
      jsonRequest("http://localhost/api/media-groups", {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({
          titleFr: `${GROUP_P}-orphan`,
          layout: MediaGroupLayout.GRID,
          mediaIds: [unreferencedGroupMediaId],
        }),
      })
    );

    await patchPost(
      jsonRequest(`http://localhost/api/posts/${publishedId}`, {
        method: "PATCH",
        headers: bearerHeaders(),
        body: JSON.stringify({
          bodyFr: `Intro\n\n${mediaGroupPlaceholder(publishedGroupId)}\n\nFin`,
        }),
      }),
      { params: Promise.resolve({ id: publishedId }) }
    );

    await patchPost(
      jsonRequest(`http://localhost/api/posts/${draftId}`, {
        method: "PATCH",
        headers: bearerHeaders(),
        body: JSON.stringify({
          bodyFr: mediaGroupPlaceholder(draftGroupId),
        }),
      }),
      { params: Promise.resolve({ id: draftId }) }
    );

    const pubRes = await publish(
      jsonRequest(`http://localhost/api/posts/${publishedId}/publish`, {
        method: "POST",
        headers: bearerHeaders(),
      }),
      { params: Promise.resolve({ id: publishedId }) }
    );
    expect(pubRes.status).toBe(200);

    // Phase 1d: group-only media must NOT be auto-attached to PostMedia
    const links = await prisma.postMedia.findMany({
      where: { postId: publishedId },
      select: { mediaId: true },
    });
    expect(links.some((l) => l.mediaId === groupOnlyMediaId)).toBe(false);
  });

  afterAll(async () => {
    await cleanupTestPosts(PREFIX);
    await prisma.mediaGroup.deleteMany({ where: { slug: { startsWith: GROUP_P } } });
    await prisma.media.deleteMany({
      where: {
        id: {
          in: [
            coverMediaId,
            groupOnlyMediaId,
            standaloneMediaId,
            alsoPostMediaId,
            draftOnlyMediaId,
            unreferencedGroupMediaId,
          ].filter(Boolean),
        },
      },
    });
  });

  it("includes group-only media from published posts in /api/gallery", async () => {
    const { GET } = await import("@/app/api/gallery/route");
    const res = await GET(
      jsonRequest("http://localhost/api/gallery", {
        searchParams: { search: searchToken },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const ids = body.items.map((i: { id: string }) => i.id);
    expect(ids).toContain(groupOnlyMediaId);
    expect(ids).toContain(coverMediaId);
    expect(ids).toContain(standaloneMediaId);
    expect(ids).toContain(alsoPostMediaId);
    expect(ids.filter((id: string) => id === alsoPostMediaId)).toHaveLength(1);
  });

  it("excludes draft-only and unreferenced group media from public gallery", async () => {
    const { GET } = await import("@/app/api/gallery/route");
    const res = await GET(
      jsonRequest("http://localhost/api/gallery", {
        searchParams: { search: searchToken },
      })
    );
    const body = await res.json();
    const ids = body.items.map((i: { id: string }) => i.id);
    expect(ids).not.toContain(draftOnlyMediaId);
    expect(ids).not.toContain(unreferencedGroupMediaId);
  });

  it("classifies media-library visibility for group-only / draft / orphan / public", async () => {
    const { GET } = await import("@/app/api/media-library/route");

    const publicRes = await GET(
      jsonRequest("http://localhost/api/media-library", {
        headers: bearerHeaders(),
        searchParams: { visibility: "public", q: searchToken, limit: "50" },
      })
    );
    expect(publicRes.status).toBe(200);
    const publicBody = await publicRes.json();
    const publicIds = publicBody.items.map((i: { id: string }) => i.id);
    expect(publicIds).toContain(groupOnlyMediaId);
    expect(publicIds).toContain(coverMediaId);
    expect(publicIds).not.toContain(draftOnlyMediaId);
    expect(publicIds).not.toContain(unreferencedGroupMediaId);

    const draftRes = await GET(
      jsonRequest("http://localhost/api/media-library", {
        headers: bearerHeaders(),
        searchParams: { visibility: "draft", q: searchToken, limit: "50" },
      })
    );
    const draftBody = await draftRes.json();
    const draftIds = draftBody.items.map((i: { id: string }) => i.id);
    expect(draftIds).toContain(draftOnlyMediaId);
    expect(draftIds).not.toContain(groupOnlyMediaId);
    expect(draftIds).not.toContain(unreferencedGroupMediaId);

    const orphanRes = await GET(
      jsonRequest("http://localhost/api/media-library", {
        headers: bearerHeaders(),
        searchParams: { visibility: "orphan", q: searchToken, limit: "50" },
      })
    );
    const orphanBody = await orphanRes.json();
    const orphanIds = orphanBody.items.map((i: { id: string }) => i.id);
    expect(orphanIds).toContain(unreferencedGroupMediaId);
    expect(orphanIds).not.toContain(groupOnlyMediaId);
    expect(orphanIds).not.toContain(coverMediaId);
    expect(orphanIds).not.toContain(draftOnlyMediaId);

    const groupOnlyRow = publicBody.items.find(
      (i: { id: string }) => i.id === groupOnlyMediaId
    );
    expect(groupOnlyRow?.visibility).toBe("public");
    const draftRow = draftBody.items.find(
      (i: { id: string }) => i.id === draftOnlyMediaId
    );
    expect(draftRow?.visibility).toBe("draft");
  });
});
