import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSyncEnv, isSyncConfigured } from "@/lib/sync-crypto";
import {
  enqueueSyncJob,
  serializeSyncJob,
  SyncBusyError,
} from "@/lib/sync-jobs";

const bodySchema = z.object({
  milestoneId: z.string().min(1),
});

/** Publish a single milestone TEST → PROD (async). */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSyncConfigured()) {
    return NextResponse.json({ error: "Sync not configured" }, { status: 503 });
  }
  if (getSyncEnv() !== "test") {
    return NextResponse.json(
      { error: "Publish milestone to PROD is only available on TEST" },
      { status: 400 }
    );
  }

  try {
    const { milestoneId } = bodySchema.parse(await request.json());
    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
    });
    if (!milestone) {
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }

    const job = await enqueueSyncJob({
      type: "PUBLISH_MILESTONE",
      params: { milestoneId },
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
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Enqueue failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
