import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSyncEnv, isSyncConfigured } from "@/lib/sync-crypto";
import {
  enqueueSyncJob,
  serializeSyncJob,
  SyncBusyError,
} from "@/lib/sync-jobs";

/**
 * Pull PROD → TEST (async job): catalogue + posts + médias.
 * Returns 202 { job } — poll GET /api/sync/jobs/:id
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSyncConfigured()) {
    return NextResponse.json({ error: "Sync not configured" }, { status: 503 });
  }
  if (getSyncEnv() !== "test") {
    return NextResponse.json(
      { error: "Pull from PROD is only available on TEST" },
      { status: 400 }
    );
  }

  try {
    const job = await enqueueSyncJob({
      type: "PULL_FROM_PROD",
      createdBy: session.id,
    });
    return NextResponse.json(
      { ok: true, async: true, job: serializeSyncJob(job) },
      { status: 202 }
    );
  } catch (error) {
    if (error instanceof SyncBusyError) {
      return NextResponse.json(
        { error: error.message, jobId: error.activeJobId },
        { status: 409 }
      );
    }
    const message = error instanceof Error ? error.message : "Enqueue failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
