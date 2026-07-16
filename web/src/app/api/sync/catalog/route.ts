import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getSyncEnv, isSyncConfigured } from "@/lib/sync-crypto";
import {
  enqueueSyncJob,
  serializeSyncJob,
  SyncBusyError,
} from "@/lib/sync-jobs";

const bodySchema = z.object({
  direction: z.enum(["pull", "push"]),
});

/** Sync tags/themes/milestones — async job. */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSyncConfigured()) {
    return NextResponse.json({ error: "Sync not configured" }, { status: 503 });
  }

  try {
    const { direction } = bodySchema.parse(await request.json());
    const job = await enqueueSyncJob({
      type: direction === "pull" ? "CATALOG_PULL" : "CATALOG_PUSH",
      params: { direction },
      createdBy: session.id,
    });
    return NextResponse.json(
      {
        ok: true,
        async: true,
        env: getSyncEnv(),
        job: serializeSyncJob(job),
      },
      { status: 202 }
    );
  } catch (error) {
    if (error instanceof SyncBusyError) {
      return NextResponse.json(
        { error: error.message, jobId: error.activeJobId },
        { status: 409 }
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Enqueue failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
