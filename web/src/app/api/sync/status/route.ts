import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSyncEnv, isSyncConfigured, peerFetch } from "@/lib/sync-crypto";
import { exportPostSummaries, type SyncPostSummary } from "@/lib/sync";
import { getActiveSyncJob, serializeSyncJob } from "@/lib/sync-jobs";

type MilestoneSummary = {
  id: string;
  slug: string;
  titleFr: string;
  titleEn: string;
  milestoneDate: string;
  sortOrder: number;
};

function compareById<T extends { id: string; titleFr?: string }>(
  local: T[],
  peer: T[],
  divergedFn?: (a: T, b: T) => boolean
) {
  const localMap = new Map(local.map((p) => [p.id, p]));
  const peerMap = new Map(peer.map((p) => [p.id, p]));
  const onlyLocal = local.filter((p) => !peerMap.has(p.id));
  const onlyPeer = peer.filter((p) => !localMap.has(p.id));
  const both = local
    .filter((p) => peerMap.has(p.id))
    .map((p) => ({
      local: p,
      peer: peerMap.get(p.id)!,
      diverged: divergedFn ? divergedFn(p, peerMap.get(p.id)!) : false,
    }));
  return {
    onlyLocal,
    onlyPeer,
    both,
    counts: {
      local: local.length,
      peer: peer.length,
      onlyLocal: onlyLocal.length,
      onlyPeer: onlyPeer.length,
      both: both.length,
    },
  };
}

/** Compare local posts + milestones with peer — session required. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSyncConfigured()) {
    return NextResponse.json({
      configured: false,
      env: getSyncEnv(),
      message: "SYNC_* env vars not configured",
      activeJob: null,
    });
  }

  const activeJobRow = await getActiveSyncJob();

  const localPosts = await exportPostSummaries();
  const localMilestones: MilestoneSummary[] = (
    await prisma.milestone.findMany({
      orderBy: [{ milestoneDate: "asc" }, { sortOrder: "asc" }],
    })
  ).map((m) => ({
    id: m.id,
    slug: m.slug,
    titleFr: m.titleFr,
    titleEn: m.titleEn,
    milestoneDate: m.milestoneDate.toISOString(),
    sortOrder: m.sortOrder,
  }));

  const [peerPostsRes, peerCatalogRes] = await Promise.all([
    peerFetch("/api/sync/peer/export?resource=summaries", "export"),
    peerFetch("/api/sync/peer/export?resource=catalog", "export"),
  ]);

  if (!peerPostsRes.ok) {
    return NextResponse.json(
      { error: `Peer posts export failed: ${await peerPostsRes.text()}` },
      { status: 502 }
    );
  }
  if (!peerCatalogRes.ok) {
    return NextResponse.json(
      { error: `Peer catalog export failed: ${await peerCatalogRes.text()}` },
      { status: 502 }
    );
  }

  const peerPosts = (await peerPostsRes.json()) as SyncPostSummary[];
  const peerCatalog = (await peerCatalogRes.json()) as {
    milestones: MilestoneSummary[];
  };
  const peerMilestones = peerCatalog.milestones ?? [];

  const posts = compareById(localPosts, peerPosts, (a, b) => a.updatedAt !== b.updatedAt);
  const milestones = compareById(
    localMilestones,
    peerMilestones,
    (a, b) =>
      a.titleFr !== b.titleFr ||
      a.titleEn !== b.titleEn ||
      a.milestoneDate !== b.milestoneDate ||
      a.sortOrder !== b.sortOrder
  );

  return NextResponse.json({
    configured: true,
    env: getSyncEnv(),
    activeJob: activeJobRow ? serializeSyncJob(activeJobRow) : null,
    ...posts,
    counts: posts.counts,
    milestones: {
      ...milestones,
    },
  });
}
