import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSyncEnv, isSyncConfigured, peerFetch } from "@/lib/sync-crypto";
import { exportPostSummaries, type SyncPostSummary } from "@/lib/sync";

/** Compare local posts with peer — session required. */
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
    });
  }

  const local = await exportPostSummaries();
  const peerRes = await peerFetch("/api/sync/peer/export?resource=summaries", "export");
  if (!peerRes.ok) {
    const err = await peerRes.text();
    return NextResponse.json(
      { error: `Peer export failed: ${err}` },
      { status: 502 }
    );
  }
  const peer = (await peerRes.json()) as SyncPostSummary[];

  const localMap = new Map(local.map((p) => [p.id, p]));
  const peerMap = new Map(peer.map((p) => [p.id, p]));

  const onlyLocal = local.filter((p) => !peerMap.has(p.id));
  const onlyPeer = peer.filter((p) => !localMap.has(p.id));
  const both = local
    .filter((p) => peerMap.has(p.id))
    .map((p) => ({
      local: p,
      peer: peerMap.get(p.id)!,
      diverged: p.updatedAt !== peerMap.get(p.id)!.updatedAt,
    }));

  return NextResponse.json({
    configured: true,
    env: getSyncEnv(),
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
  });
}
