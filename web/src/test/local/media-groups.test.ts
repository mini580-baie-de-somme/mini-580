import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { MediaGroupLayout } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { mediaGroupPlaceholder } from "@/lib/media-group-token";
import { buildArticleMediaManifest } from "@/lib/article-media-manifest";
import {
  bearerHeaders,
  cleanupTestPosts,
  ensureAdminUser,
  jsonRequest,
  uniqueSlug,
} from "../helpers";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

const GROUP_P = "it-mgrp-api";
const POST_P = "it-mgrp-post";

describe("API integration — Media groups (Phase 1d-b)", () => {
  let mediaAId: string;
  let mediaBId: string;
  let groupId: string;
  let postId: string;

  beforeAll(async () => {
    await ensureAdminUser();
    await cleanupTestPosts(POST_P);
    await prisma.mediaGroup.deleteMany({ where: { slug: { startsWith: GROUP_P } } });

    const mediaA = await prisma.media.create({
      data: {
        urlOrigin: "/media/2026/08/grp-a.jpg",
        titleFr: "A",
        slug: uniqueSlug(`${GROUP_P}-a`),
      },
    });
    const mediaB = await prisma.media.create({
      data: {
        urlOrigin: "/media/2026/08/grp-b.jpg",
        titleFr: "B",
        slug: uniqueSlug(`${GROUP_P}-b`),
      },
    });
    mediaAId = mediaA.id;
    mediaBId = mediaB.id;
  });

  afterAll(async () => {
    await cleanupTestPosts(POST_P);
    if (groupId) {
      await prisma.mediaGroup.deleteMany({ where: { id: groupId } });
    }
    await prisma.media.deleteMany({
      where: { id: { in: [mediaAId, mediaBId].filter(Boolean) } },
    });
    await prisma.mediaGroup.deleteMany({ where: { slug: { startsWith: GROUP_P } } });
  });

  it("CRUD media groups with Bearer", async () => {
    const { POST, GET } = await import("@/app/api/media-groups/route");
    const slug = uniqueSlug(GROUP_P);

    const createRes = await POST(
      jsonRequest("http://localhost/api/media-groups", {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({
          titleFr: "Montage test",
          titleEn: "Test montage",
          slug,
          layout: MediaGroupLayout.GRID,
          mediaIds: [mediaAId, mediaBId],
        }),
      })
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    groupId = created.id;
    expect(created.slug).toBe(slug);
    expect(created.members).toHaveLength(2);
    expect(created.members[0]?.mediaId).toBe(mediaAId);

    const listRes = await GET(
      jsonRequest("http://localhost/api/media-groups", {
        headers: bearerHeaders(),
        searchParams: { q: slug },
      })
    );
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    expect(list.items.some((g: { id: string }) => g.id === groupId)).toBe(true);

    const { GET: getOne, PATCH, DELETE } = await import(
      "@/app/api/media-groups/[id]/route"
    );

    const detailRes = await getOne(
      jsonRequest(`http://localhost/api/media-groups/${groupId}`, {
        headers: bearerHeaders(),
      }),
      { params: Promise.resolve({ id: groupId }) }
    );
    expect(detailRes.status).toBe(200);
    const detail = await detailRes.json();
    expect(detail.referencedByPostIds).toEqual([]);

    const patchRes = await PATCH(
      jsonRequest(`http://localhost/api/media-groups/${groupId}`, {
        method: "PATCH",
        headers: bearerHeaders(),
        body: JSON.stringify({
          titleFr: "Montage modifié",
          mediaIds: [mediaBId, mediaAId],
        }),
      }),
      { params: Promise.resolve({ id: groupId }) }
    );
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.titleFr).toBe("Montage modifié");
    expect(patched.members[0]?.mediaId).toBe(mediaBId);

    const delRes = await DELETE(
      jsonRequest(`http://localhost/api/media-groups/${groupId}`, {
        method: "DELETE",
        headers: bearerHeaders(),
      }),
      { params: Promise.resolve({ id: groupId }) }
    );
    expect(delRes.status).toBe(200);
    groupId = "";
  });

  it("DELETE returns 409 when group is referenced in post body", async () => {
    const { POST } = await import("@/app/api/media-groups/route");
    const { POST: createPost } = await import("@/app/api/posts/route");
    const { PATCH: patchPost } = await import("@/app/api/posts/[id]/route");
    const { DELETE } = await import("@/app/api/media-groups/[id]/route");
    const { GET: getRefs } = await import(
      "@/app/api/media-groups/[id]/references/route"
    );

    const slug = uniqueSlug(GROUP_P);
    const createGroupRes = await POST(
      jsonRequest("http://localhost/api/media-groups", {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({ titleFr: "Ref test", slug, mediaIds: [mediaAId] }),
      })
    );
    const group = await createGroupRes.json();
    groupId = group.id;
    const token = mediaGroupPlaceholder(group.id);

    const postSlug = uniqueSlug(POST_P);
    const postRes = await createPost(
      jsonRequest("http://localhost/api/posts", {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({ titleFr: postSlug, titleEn: "EN" }),
      })
    );
    const post = await postRes.json();
    postId = post.id;

    await patchPost(
      jsonRequest(`http://localhost/api/posts/${postId}`, {
        method: "PATCH",
        headers: bearerHeaders(),
        body: JSON.stringify({ bodyFr: `Intro\n\n${token}\n\nFin` }),
      }),
      { params: Promise.resolve({ id: postId }) }
    );

    const refsRes = await getRefs(
      jsonRequest(`http://localhost/api/media-groups/${groupId}/references`, {
        headers: bearerHeaders(),
      }),
      { params: Promise.resolve({ id: groupId }) }
    );
    expect(refsRes.status).toBe(200);
    const refs = await refsRes.json();
    expect(refs.total).toBe(1);
    expect(refs.posts[0]?.id).toBe(postId);

    const delRes = await DELETE(
      jsonRequest(`http://localhost/api/media-groups/${groupId}`, {
        method: "DELETE",
        headers: bearerHeaders(),
      }),
      { params: Promise.resolve({ id: groupId }) }
    );
    expect(delRes.status).toBe(409);
    const delBody = await delRes.json();
    expect(delBody.referencedByPostIds).toContain(postId);
  });

  it("GET /api/posts/:id/media-manifest builds unified order with dedupe", async () => {
    const { POST: createPost } = await import("@/app/api/posts/route");
    const { POST: attachMedia } = await import("@/app/api/posts/[id]/media/route");
    const { GET: getManifest } = await import(
      "@/app/api/posts/[id]/media-manifest/route"
    );
    const { POST: createGroup } = await import("@/app/api/media-groups/route");
    const { PATCH: patchPost } = await import("@/app/api/posts/[id]/route");

    const postSlug = uniqueSlug(`${POST_P}-manifest`);
    const postRes = await createPost(
      jsonRequest("http://localhost/api/posts", {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({ titleFr: postSlug, titleEn: "Manifest EN" }),
      })
    );
    const post = await postRes.json();
    postId = post.id;

    await attachMedia(
      jsonRequest(`http://localhost/api/posts/${postId}/media`, {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({ mediaIds: [mediaAId, mediaBId], setCoverFirst: true }),
      }),
      { params: Promise.resolve({ id: postId }) }
    );

    const groupRes = await createGroup(
      jsonRequest("http://localhost/api/media-groups", {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({
          titleFr: "Inline",
          slug: uniqueSlug(`${GROUP_P}-inline`),
          mediaIds: [mediaAId],
        }),
      })
    );
    const group = await groupRes.json();
    groupId = group.id;

    await patchPost(
      jsonRequest(`http://localhost/api/posts/${postId}`, {
        method: "PATCH",
        headers: bearerHeaders(),
        body: JSON.stringify({
          bodyFr: `Texte\n\n${mediaGroupPlaceholder(group.id)}\n\nFin`,
        }),
      }),
      { params: Promise.resolve({ id: postId }) }
    );

    const manifestRes = await getManifest(
      jsonRequest(`http://localhost/api/posts/${postId}/media-manifest`, {
        headers: bearerHeaders(),
        searchParams: { locale: "fr" },
      }),
      { params: Promise.resolve({ id: postId }) }
    );
    expect(manifestRes.status).toBe(200);
    const manifest = await manifestRes.json();
    expect(manifest.total).toBe(2);
    expect(manifest.items[0]?.source).toBe("cover");
    expect(manifest.items[0]?.mediaId).toBe(mediaAId);
    expect(manifest.items[1]?.source).toBe("standalone");
    expect(manifest.items[1]?.mediaId).toBe(mediaBId);

    const postRow = await prisma.post.findUniqueOrThrow({
      where: { id: postId },
      include: { mediaLinks: { include: { media: true } } },
    });
    const built = await buildArticleMediaManifest(
      {
        id: postRow.id,
        coverImageUrl: postRow.coverImageUrl,
        bodyFr: postRow.bodyFr,
        bodyEn: postRow.bodyEn,
        mediaLinks: postRow.mediaLinks,
      },
      "fr"
    );
    expect(built).toHaveLength(2);
  });

  it("slug-history resolves post redirect to canonical slug", async () => {
    const { GET } = await import("@/app/api/slug-history/[entity]/[slug]/route");
    const { POST: createPost } = await import("@/app/api/posts/route");
    const { PATCH: patchPost } = await import("@/app/api/posts/[id]/route");

    const oldSlug = uniqueSlug(`${POST_P}-old`);
    const postRes = await createPost(
      jsonRequest("http://localhost/api/posts", {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({ titleFr: oldSlug, titleEn: "Slug hist" }),
      })
    );
    const post = await postRes.json();
    postId = post.id;
    expect(post.slug).toBe(oldSlug);

    const newTitle = uniqueSlug(`${POST_P}-new`);
    await patchPost(
      jsonRequest(`http://localhost/api/posts/${postId}`, {
        method: "PATCH",
        headers: bearerHeaders(),
        body: JSON.stringify({ titleFr: newTitle }),
      }),
      { params: Promise.resolve({ id: postId }) }
    );

    const updated = await prisma.post.findUniqueOrThrow({ where: { id: postId } });
    expect(updated.slug).not.toBe(oldSlug);

    const histRes = await GET(
      jsonRequest(`http://localhost/api/slug-history/post/${oldSlug}`, {}),
      { params: Promise.resolve({ entity: "post", slug: oldSlug }) }
    );
    expect(histRes.status).toBe(200);
    const hist = await histRes.json();
    expect(hist.canonicalSlug).toBe(updated.slug);
    expect(hist.redirectPath).toBe(`/blog/${updated.slug}`);
  });

  it("media-library filters by groupId", async () => {
    const { POST: createGroup } = await import("@/app/api/media-groups/route");
    const { GET } = await import("@/app/api/media-library/route");

    const groupRes = await createGroup(
      jsonRequest("http://localhost/api/media-groups", {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({
          titleFr: "Filtre",
          slug: uniqueSlug(`${GROUP_P}-filter`),
          mediaIds: [mediaAId, mediaBId],
        }),
      })
    );
    const group = await groupRes.json();
    groupId = group.id;

    const res = await GET(
      jsonRequest("http://localhost/api/media-library", {
        headers: bearerHeaders(),
        searchParams: { groupId: group.id },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(2);
    expect(body.items).toHaveLength(2);
    expect(body.items.some((m: { id: string }) => m.id === mediaAId)).toBe(true);
    expect(body.items.some((m: { id: string }) => m.id === mediaBId)).toBe(true);
  });

  it("media-library groupId filter ignores virtual group overlay param", async () => {
    const { POST: createGroup } = await import("@/app/api/media-groups/route");
    const { GET } = await import("@/app/api/media-library/route");

    const groupRes = await createGroup(
      jsonRequest("http://localhost/api/media-groups", {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({
          titleFr: "Overlay",
          slug: uniqueSlug(`${GROUP_P}-overlay`),
          mediaIds: [mediaBId],
        }),
      })
    );
    const group = await groupRes.json();
    groupId = group.id;

    const res = await GET(
      jsonRequest("http://localhost/api/media-library", {
        headers: bearerHeaders(),
        searchParams: { group: "other-group", groupId: group.id },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.items.every((m: { id: string }) => m.id === mediaBId)).toBe(true);
  });

  it("inserts media group placeholder via posts.insert-media-group API", async () => {
    const { POST: createGroup } = await import("@/app/api/media-groups/route");
    const { POST: createPost } = await import("@/app/api/posts/route");
    const { POST: insertGroup } = await import(
      "@/app/api/posts/[id]/insert-media-group/route"
    );

    const groupRes = await createGroup(
      jsonRequest("http://localhost/api/media-groups", {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({
          titleFr: "Inline",
          slug: uniqueSlug(`${GROUP_P}-inline`),
          mediaIds: [mediaAId],
        }),
      })
    );
    const group = await groupRes.json();
    groupId = group.id;

    const postRes = await createPost(
      jsonRequest("http://localhost/api/posts", {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({ titleFr: uniqueSlug(`${POST_P}-inline`) }),
      })
    );
    const post = await postRes.json();
    postId = post.id;

    const insertRes = await insertGroup(
      jsonRequest(`http://localhost/api/posts/${postId}/insert-media-group`, {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({ groupId: group.id, lang: "both", position: "end" }),
      }),
      { params: Promise.resolve({ id: postId }) }
    );
    expect(insertRes.status).toBe(200);
    const inserted = await insertRes.json();
    expect(inserted.inserted.placeholder).toBe(`{{media-group:${group.id}}}`);
    expect(inserted.post.bodyFr).toContain(`{{media-group:${group.id}}}`);
    expect(inserted.post.bodyEn).toContain(`{{media-group:${group.id}}}`);
  });

  it("add_media, reorder, remove_media member mutations", async () => {
    const { POST: createGroup } = await import("@/app/api/media-groups/route");
    const { POST: addMember } = await import(
      "@/app/api/media-groups/[id]/members/route"
    );
    const { PUT: reorder } = await import(
      "@/app/api/media-groups/[id]/members/reorder/route"
    );
    const { DELETE: removeMember } = await import(
      "@/app/api/media-groups/[id]/members/[mediaId]/route"
    );

    const groupRes = await createGroup(
      jsonRequest("http://localhost/api/media-groups", {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({
          titleFr: "Members",
          slug: uniqueSlug(`${GROUP_P}-members`),
          mediaIds: [mediaAId],
        }),
      })
    );
    const group = await groupRes.json();
    groupId = group.id;

    const addRes = await addMember(
      jsonRequest(`http://localhost/api/media-groups/${groupId}/members`, {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({ mediaId: mediaBId }),
      }),
      { params: Promise.resolve({ id: groupId }) }
    );
    expect(addRes.status).toBe(200);
    let detail = await addRes.json();
    expect(detail.members.map((m: { mediaId: string }) => m.mediaId)).toEqual([
      mediaAId,
      mediaBId,
    ]);

    const reorderRes = await reorder(
      jsonRequest(`http://localhost/api/media-groups/${groupId}/members/reorder`, {
        method: "PUT",
        headers: bearerHeaders(),
        body: JSON.stringify({ mediaIds: [mediaBId, mediaAId] }),
      }),
      { params: Promise.resolve({ id: groupId }) }
    );
    expect(reorderRes.status).toBe(200);
    detail = await reorderRes.json();
    expect(detail.members.map((m: { mediaId: string }) => m.mediaId)).toEqual([
      mediaBId,
      mediaAId,
    ]);

    const removeRes = await removeMember(
      jsonRequest(`http://localhost/api/media-groups/${groupId}/members/${mediaAId}`, {
        method: "DELETE",
        headers: bearerHeaders(),
      }),
      { params: Promise.resolve({ id: groupId, mediaId: mediaAId }) }
    );
    expect(removeRes.status).toBe(200);
    detail = await removeRes.json();
    expect(detail.members.map((m: { mediaId: string }) => m.mediaId)).toEqual([mediaBId]);
  });
});
