import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSyncEnv, isSyncConfigured, peerFetch } from "@/lib/sync-crypto";
import { exportCatalog } from "@/lib/sync";

const bodySchema = z.object({
  milestoneId: z.string().min(1),
});

/** Publish a single milestone from TEST → PROD (same id). */
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
    const milestone = await prisma.milestone.findUnique({ where: { id: milestoneId } });
    if (!milestone) {
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }

    const catalog = await exportCatalog();
    const payload = {
      tags: [] as typeof catalog.tags,
      themes: [] as typeof catalog.themes,
      milestones: catalog.milestones.filter((m) => m.id === milestoneId),
    };

    if (payload.milestones.length === 0) {
      return NextResponse.json({ error: "Milestone missing from export" }, { status: 404 });
    }

    const res = await peerFetch("/api/sync/peer/import", "import", {
      method: "PUT",
      body: JSON.stringify({ type: "catalog", payload }),
    });
    if (!res.ok) {
      throw new Error(`Peer import failed: ${await res.text()}`);
    }

    return NextResponse.json({ ok: true, id: milestoneId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Publish failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
