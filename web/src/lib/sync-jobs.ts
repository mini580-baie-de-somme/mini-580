import "server-only";

import { SyncJobType, Prisma, type SyncJob } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { peerFetch } from "@/lib/sync-crypto";
import {
  applyProdPostsToTest,
  exportCatalog,
  exportPostById,
  upsertCatalog,
  type SyncCatalogPayload,
  type SyncPostPayload,
} from "@/lib/sync";
import {
  collectMediaKeysFromPost,
  pullMediaKeysFromPeer,
  pushMediaKeysToPeer,
} from "@/lib/sync-media";

export class SyncBusyError extends Error {
  constructor(public readonly activeJobId: string) {
    super(`Sync already in progress (${activeJobId})`);
    this.name = "SyncBusyError";
  }
}

export async function getActiveSyncJob(): Promise<SyncJob | null> {
  return prisma.syncJob.findFirst({
    where: { status: { in: ["PENDING", "RUNNING"] } },
    orderBy: { createdAt: "desc" },
  });
}

async function assertIdle() {
  const active = await getActiveSyncJob();
  if (active) throw new SyncBusyError(active.id);
}

type JobParams = {
  postId?: string;
  publish?: boolean;
  milestoneId?: string;
  direction?: "pull" | "push";
};

export async function enqueueSyncJob(input: {
  type: SyncJobType;
  params?: JobParams;
  createdBy?: string;
}): Promise<SyncJob> {
  await assertIdle();

  const job = await prisma.syncJob.create({
    data: {
      type: input.type,
      status: "PENDING",
      params: (input.params ?? {}) as Prisma.InputJsonValue,
      createdBy: input.createdBy,
      progress: { step: "queued", current: 0, total: 0, message: "En file" },
    },
  });

  // Fire-and-forget background work (Node container keeps the promise alive)
  setImmediate(() => {
    void runSyncJob(job.id);
  });

  return job;
}

async function updateProgress(
  jobId: string,
  progress: Prisma.InputJsonValue
) {
  await prisma.syncJob.update({
    where: { id: jobId },
    data: { progress },
  });
}

export async function runSyncJob(jobId: string): Promise<void> {
  const job = await prisma.syncJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== "PENDING") return;

  await prisma.syncJob.update({
    where: { id: jobId },
    data: {
      status: "RUNNING",
      startedAt: new Date(),
      progress: { step: "start", message: "Démarrage" },
    },
  });

  try {
    const params = (job.params ?? {}) as JobParams;
    let result: Prisma.InputJsonValue = {};

    switch (job.type) {
      case "PULL_FROM_PROD":
        result = await runPullFromProd(jobId);
        break;
      case "PUBLISH_POST":
        if (!params.postId) throw new Error("postId required");
        result = await runPublishPost(jobId, params.postId, !!params.publish);
        break;
      case "PUBLISH_MILESTONE":
        if (!params.milestoneId) throw new Error("milestoneId required");
        result = await runPublishMilestone(jobId, params.milestoneId);
        break;
      case "CATALOG_PULL":
        result = await runCatalog(jobId, "pull");
        break;
      case "CATALOG_PUSH":
        result = await runCatalog(jobId, "push");
        break;
      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }

    await prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        result,
        progress: {
          step: "done",
          message: "Terminé",
          current: 1,
          total: 1,
        },
        error: null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    await prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        error: message,
        progress: { step: "error", message },
      },
    });
  }
}

async function runPullFromProd(jobId: string) {
  await updateProgress(jobId, {
    step: "catalog",
    message: "Import catalogue PROD",
  });
  const catalogRes = await peerFetch(
    "/api/sync/peer/export?resource=catalog",
    "export"
  );
  if (!catalogRes.ok) {
    throw new Error(`Catalog export failed: ${await catalogRes.text()}`);
  }
  const catalog = (await catalogRes.json()) as SyncCatalogPayload;
  await upsertCatalog(catalog);

  await updateProgress(jobId, {
    step: "posts",
    message: "Export articles PROD",
  });
  const postsRes = await peerFetch(
    "/api/sync/peer/export?resource=posts",
    "export"
  );
  if (!postsRes.ok) {
    throw new Error(`Posts export failed: ${await postsRes.text()}`);
  }
  const posts = (await postsRes.json()) as SyncPostPayload[];

  const allKeys = posts.flatMap((p) => collectMediaKeysFromPost(p));
  await updateProgress(jobId, {
    step: "media",
    message: `Médias (${allKeys.length})`,
    current: 0,
    total: allKeys.length,
  });
  const media = await pullMediaKeysFromPeer(allKeys, (done, total, key) => {
    void updateProgress(jobId, {
      step: "media",
      message: key ? `Médias: ${key}` : "Médias",
      current: done,
      total,
    });
  });

  await updateProgress(jobId, {
    step: "upsert",
    message: "Upsert articles",
  });
  const postsResult = await applyProdPostsToTest(posts);

  return {
    catalog: {
      tags: catalog.tags.length,
      themes: catalog.themes.length,
      milestones: catalog.milestones.length,
    },
    posts: postsResult,
    media,
  };
}

async function runPublishPost(
  jobId: string,
  postId: string,
  publish: boolean
) {
  if (publish) {
    await prisma.post.update({
      where: { id: postId },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });
  }

  const payload = await exportPostById(postId);
  if (!payload) throw new Error("Post not found");

  const keys = collectMediaKeysFromPost(payload);
  await updateProgress(jobId, {
    step: "media",
    message: `Push médias (${keys.length})`,
    current: 0,
    total: keys.length,
  });
  const media = await pushMediaKeysToPeer(keys, (done, total, key) => {
    void updateProgress(jobId, {
      step: "media",
      message: key ? `Médias → PROD: ${key}` : "Médias",
      current: done,
      total,
    });
  });

  await updateProgress(jobId, {
    step: "import",
    message: "Import article sur PROD",
  });
  const res = await peerFetch("/api/sync/peer/import", "import", {
    method: "PUT",
    body: JSON.stringify({ type: "post", payload }),
  });
  if (!res.ok) {
    throw new Error(`Peer import failed: ${await res.text()}`);
  }

  return { postId, media, peer: await res.json() };
}

async function runPublishMilestone(jobId: string, milestoneId: string) {
  await updateProgress(jobId, {
    step: "catalog",
    message: "Push jalon",
  });
  const catalog = await exportCatalog();
  const milestone = catalog.milestones.find((m) => m.id === milestoneId);
  if (!milestone) throw new Error("Milestone not found");

  const payload: SyncCatalogPayload = {
    tags: [],
    themes: [],
    milestones: [milestone],
  };
  const res = await peerFetch("/api/sync/peer/import", "import", {
    method: "PUT",
    body: JSON.stringify({ type: "catalog", payload }),
  });
  if (!res.ok) {
    throw new Error(`Peer import failed: ${await res.text()}`);
  }
  return { milestoneId, peer: await res.json() };
}

async function runCatalog(jobId: string, direction: "pull" | "push") {
  if (direction === "pull") {
    await updateProgress(jobId, {
      step: "catalog",
      message: "Pull catalogue peer",
    });
    const res = await peerFetch(
      "/api/sync/peer/export?resource=catalog",
      "export"
    );
    if (!res.ok) throw new Error(`Catalog export failed: ${await res.text()}`);
    const catalog = (await res.json()) as SyncCatalogPayload;
    await upsertCatalog(catalog);
    return {
      direction,
      tags: catalog.tags.length,
      themes: catalog.themes.length,
      milestones: catalog.milestones.length,
    };
  }

  await updateProgress(jobId, {
    step: "catalog",
    message: "Push catalogue peer",
  });
  const catalog = await exportCatalog();
  const res = await peerFetch("/api/sync/peer/import", "import", {
    method: "PUT",
    body: JSON.stringify({ type: "catalog", payload: catalog }),
  });
  if (!res.ok) throw new Error(`Catalog import failed: ${await res.text()}`);
  return {
    direction,
    tags: catalog.tags.length,
    themes: catalog.themes.length,
    milestones: catalog.milestones.length,
  };
}

export function serializeSyncJob(job: SyncJob) {
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    params: job.params,
    progress: job.progress,
    result: job.result,
    error: job.error,
    createdBy: job.createdBy,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
  };
}
