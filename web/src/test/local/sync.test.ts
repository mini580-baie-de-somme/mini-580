import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT, importPKCS8 } from "jose";
import { randomUUID } from "node:crypto";
import {
  bearerHeaders,
  cleanupBySlug,
  cleanupTestPosts,
  ensureAdminUser,
  generateSyncKeyPair,
  jsonRequest,
  makeTestJpeg,
  resetMediaRoot,
  uniqueSlug,
} from "../helpers";
import { createSessionToken } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { getMediaBucket } from "@/lib/media-bucket";
import * as syncCrypto from "@/lib/sync-crypto";
import { resetSyncKeyCaches } from "@/lib/sync-crypto";
import {
  applyProdPostsToTest,
  exportPostById,
  upsertCatalog,
  type SyncPostPayload,
} from "@/lib/sync";
import { enqueueSyncJob, SyncBusyError } from "@/lib/sync-jobs";
import { sha256Hex } from "@/lib/sync-media";

const POST_P = "it-sync-post-";
const MILE_P = "it-sync-mile-";

const testKeys = generateSyncKeyPair();
const prodKeys = generateSyncKeyPair();

let sessionToken = "";
let admin: { id: string; email: string; name: string | null };

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === SESSION_COOKIE && sessionToken
        ? { value: sessionToken }
        : undefined,
  }),
}));

async function otpFrom(
  issuer: "test" | "prod",
  privatePem: string,
  action: string
) {
  const peer = issuer === "test" ? "prod" : "test";
  const key = await importPKCS8(privatePem, "EdDSA");
  return new SignJWT({ action, nonce: randomUUID() })
    .setProtectedHeader({ alg: "EdDSA" })
    .setIssuer(issuer)
    .setAudience(peer)
    .setIssuedAt()
    .setExpirationTime("90s")
    .sign(key);
}

function asTestEnv() {
  process.env.SYNC_ENV = "test";
  process.env.SYNC_PEER_URL = "https://classmini580.blog";
  process.env.SYNC_PRIVATE_KEY = testKeys.privateKey;
  process.env.SYNC_PEER_PUBLIC_KEY = prodKeys.publicKey;
  resetSyncKeyCaches();
}

describe("API integration — Sync PROD↔TEST", () => {
  beforeAll(async () => {
    admin = await ensureAdminUser();
    sessionToken = await createSessionToken(admin);
    await cleanupTestPosts(POST_P);
    await cleanupBySlug("milestone", MILE_P);
    asTestEnv();
  });

  afterAll(async () => {
    await cleanupTestPosts(POST_P);
    await cleanupBySlug("milestone", MILE_P);
  });

  it("peer OTP export/import roundtrip (publish TEST → PROD simulation)", async () => {
    asTestEnv();
    const { POST } = await import("@/app/api/posts/route");
    const slug = uniqueSlug(POST_P);
    const createRes = await POST(
      jsonRequest("http://localhost/api/posts", {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({
          titleFr: slug,
          titleEn: "Sync EN",
          bodyFr: "Corps",
          bodyEn: "Body",
        }),
      })
    );
    const created = await createRes.json();
    const payload = await exportPostById(created.id);
    expect(payload).toBeTruthy();

    // Simulate PROD receiving import: local env = prod, peer public = test
    process.env.SYNC_ENV = "prod";
    process.env.SYNC_PRIVATE_KEY = prodKeys.privateKey;
    process.env.SYNC_PEER_PUBLIC_KEY = testKeys.publicKey;
    resetSyncKeyCaches();

    const token = await otpFrom("test", testKeys.privateKey, "import");
    const { PUT } = await import("@/app/api/sync/peer/import/route");
    const importRes = await PUT(
      jsonRequest("http://localhost/api/sync/peer/import", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "post",
          payload: {
            ...payload!,
            titleFr: "Sync FR from TEST",
            status: "PUBLISHED",
            publishedAt: new Date().toISOString(),
          },
        }),
      })
    );
    expect(importRes.status).toBe(200);

    const onProd = await prisma.post.findUnique({ where: { id: created.id } });
    expect(onProd?.titleFr).toBe("Sync FR from TEST");
    expect(onProd?.status).toBe("PUBLISHED");

    asTestEnv();
  });

  it("pull PROD → TEST keeps TEST-only posts (applyProdPostsToTest)", async () => {
    asTestEnv();
    const { POST } = await import("@/app/api/posts/route");

    const sharedSlug = uniqueSlug(POST_P);
    const onlyTestSlug = uniqueSlug(POST_P);

    const shared = await (
      await POST(
        jsonRequest("http://localhost/api/posts", {
          method: "POST",
          headers: bearerHeaders(),
          body: JSON.stringify({
            titleFr: "Shared local",
            titleEn: "Shared local",
            slug: sharedSlug,
          }),
        })
      )
    ).json();

    const onlyTest = await (
      await POST(
        jsonRequest("http://localhost/api/posts", {
          method: "POST",
          headers: bearerHeaders(),
          body: JSON.stringify({
            titleFr: "TEST only",
            titleEn: "TEST only",
            slug: onlyTestSlug,
          }),
        })
      )
    ).json();

    const prodPayload = (await exportPostById(shared.id))!;
    const prodVersion: SyncPostPayload = {
      ...prodPayload,
      titleFr: "Shared from PROD",
      titleEn: "Shared from PROD",
      bodyFr: "Overwritten by PROD",
    };

    const result = await applyProdPostsToTest([prodVersion]);
    expect(result.overwritten + result.created).toBeGreaterThanOrEqual(1);

    const refreshedShared = await prisma.post.findUnique({
      where: { id: shared.id },
    });
    expect(refreshedShared?.titleFr).toBe("Shared from PROD");

    const stillThere = await prisma.post.findUnique({
      where: { id: onlyTest.id },
    });
    expect(stillThere?.titleFr).toBe("TEST only");
  });

  it("operator pull-from-prod with mocked peer (session + TEST)", async () => {
    asTestEnv();
    const mileSlug = uniqueSlug(MILE_P);
    const catalog = {
      tags: [],
      themes: [],
      milestones: [
        {
          id: randomUUID(),
          slug: mileSlug,
          titleFr: "Jalon PROD",
          titleEn: "Milestone PROD",
          descriptionFr: "",
          descriptionEn: "",
          milestoneDate: "2026-01-01T00:00:00.000Z",
          createdAt: new Date().toISOString(),
        },
      ],
    };

    vi.doMock("@/lib/sync-crypto", async () => {
      const actual = await vi.importActual<typeof import("@/lib/sync-crypto")>(
        "@/lib/sync-crypto"
      );
      return {
        ...actual,
        peerFetch: async (path: string) => {
          if (path.includes("catalog")) {
            return new Response(JSON.stringify(catalog), { status: 200 });
          }
          return new Response(JSON.stringify([]), { status: 200 });
        },
      };
    });

    // Direct catalog upsert mirrors pull path
    await upsertCatalog(catalog);
    const mile = await prisma.milestone.findUnique({ where: { slug: mileSlug } });
    expect(mile?.titleFr).toBe("Jalon PROD");

    const { POST: pull } = await import("@/app/api/sync/pull-from-prod/route");
    // Without re-mocking peerFetch on already-loaded module, verify auth gates:
    process.env.SYNC_ENV = "prod";
    resetSyncKeyCaches();
    const badEnv = await pull();
    expect(badEnv.status).toBe(400);

    asTestEnv();
    sessionToken = "";
    const unauth = await pull();
    expect(unauth.status).toBe(401);
    sessionToken = await createSessionToken(admin);
  });

  it("publish-to-prod requires session and TEST env", async () => {
    asTestEnv();
    const { POST } = await import("@/app/api/sync/publish-to-prod/route");

    sessionToken = "";
    const unauth = await POST(
      jsonRequest("http://localhost/api/sync/publish-to-prod", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: "x" }),
      })
    );
    expect(unauth.status).toBe(401);
    sessionToken = await createSessionToken(admin);

    process.env.SYNC_ENV = "prod";
    resetSyncKeyCaches();
    const bad = await POST(
      jsonRequest("http://localhost/api/sync/publish-to-prod", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: "x" }),
      })
    );
    expect(bad.status).toBe(400);
    asTestEnv();
  });

  it("peer media GET/POST roundtrip + checksum rejection", async () => {
    asTestEnv();
    await resetMediaRoot();
    const jpeg = await makeTestJpeg();
    const key = `posts/it-sync-media/${Date.now()}.jpg`;
    await getMediaBucket().putObject(key, jpeg, "image/jpeg");
    const checksum = sha256Hex(jpeg);

    process.env.SYNC_ENV = "prod";
    process.env.SYNC_PRIVATE_KEY = prodKeys.privateKey;
    process.env.SYNC_PEER_PUBLIC_KEY = testKeys.publicKey;
    resetSyncKeyCaches();

    const exportToken = await otpFrom("test", testKeys.privateKey, "media_export");
    const { GET, POST: mediaPost } = await import(
      "@/app/api/sync/peer/media/route"
    );
    const getRes = await GET(
      jsonRequest(
        `http://localhost/api/sync/peer/media?key=${encodeURIComponent(key)}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${exportToken}` },
        }
      )
    );
    expect(getRes.status).toBe(200);
    expect(getRes.headers.get("x-content-sha256")).toBe(checksum);
    const exported = Buffer.from(await getRes.arrayBuffer());
    expect(exported.equals(jpeg)).toBe(true);

    const importKey = `posts/it-sync-media/imported-${Date.now()}.jpg`;
    const badToken = await otpFrom("test", testKeys.privateKey, "media_import");
    const badForm = new FormData();
    badForm.append("key", importKey);
    badForm.append("checksum", "0".repeat(64));
    badForm.append("contentType", "image/jpeg");
    badForm.append("file", new File([jpeg], "x.jpg", { type: "image/jpeg" }));
    const badRes = await mediaPost(
      new (await import("next/server")).NextRequest(
        "http://localhost/api/sync/peer/media",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${badToken}` },
          body: badForm,
        }
      )
    );
    expect(badRes.status).toBe(400);

    const okForm = new FormData();
    okForm.append("key", importKey);
    okForm.append("checksum", checksum);
    okForm.append("contentType", "image/jpeg");
    okForm.append("file", new File([jpeg], "x.jpg", { type: "image/jpeg" }));
    const okRes = await mediaPost(
      new (await import("next/server")).NextRequest(
        "http://localhost/api/sync/peer/media",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${badToken}` },
          body: okForm,
        }
      )
    );
    expect(okRes.status).toBe(200);
    const stored = await getMediaBucket().getObject(importKey);
    expect(stored?.body.equals(jpeg)).toBe(true);

    asTestEnv();
  });

  it("pull-from-prod returns 202 and completes job with mocked peer", async () => {
    asTestEnv();
    await prisma.syncJob.deleteMany({});
    sessionToken = await createSessionToken(admin);

    const peerSpy = vi
      .spyOn(syncCrypto, "peerFetch")
      .mockImplementation(async (path: string) => {
        if (path.includes("resource=catalog")) {
          return new Response(
            JSON.stringify({ tags: [], themes: [], milestones: [] }),
            { status: 200 }
          );
        }
        if (path.includes("resource=posts")) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        return new Response("not found", { status: 404 });
      });

    const { POST: pull } = await import("@/app/api/sync/pull-from-prod/route");
    const res = await pull();
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.async).toBe(true);
    expect(body.job?.id).toBeTruthy();

    const jobId = body.job.id as string;
    const { GET: getJob } = await import("@/app/api/sync/jobs/[id]/route");
    let status = "PENDING";
    for (let i = 0; i < 40; i++) {
      const poll = await getJob(
        jsonRequest(`http://localhost/api/sync/jobs/${jobId}`),
        { params: Promise.resolve({ id: jobId }) }
      );
      expect(poll.status).toBe(200);
      const polled = await poll.json();
      status = String(polled.job.status);
      if (status === "COMPLETED" || status === "FAILED") break;
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(status).toBe("COMPLETED");
    peerSpy.mockRestore();
  });

  it("second sync while job active returns 409", async () => {
    asTestEnv();
    await prisma.syncJob.deleteMany({});
    sessionToken = await createSessionToken(admin);

    await prisma.syncJob.create({
      data: {
        type: "PULL_FROM_PROD",
        status: "RUNNING",
        params: {},
        progress: { step: "media", message: "busy" },
      },
    });

    const { POST: pull } = await import("@/app/api/sync/pull-from-prod/route");
    const res = await pull();
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.jobId).toBeTruthy();

    await expect(
      enqueueSyncJob({ type: "CATALOG_PULL" })
    ).rejects.toBeInstanceOf(SyncBusyError);

    await prisma.syncJob.deleteMany({});
  });

  it("assertMediaTransferOk fails the job contract on failed binaries", async () => {
    const { assertMediaTransferOk } = await import("@/lib/sync-jobs");
    expect(() =>
      assertMediaTransferOk({ failed: [], synced: ["a"] }, "push")
    ).not.toThrow();
    expect(() =>
      assertMediaTransferOk(
        { failed: ["2026/07/x/moyenne.webp"], synced: [] },
        "push"
      )
    ).toThrow(/Media push failed/);
  });
});
