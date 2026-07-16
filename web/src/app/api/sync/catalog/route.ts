import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getSyncEnv, isSyncConfigured, peerFetch } from "@/lib/sync-crypto";
import { exportCatalog, upsertCatalog, type SyncCatalogPayload } from "@/lib/sync";

const bodySchema = z.object({
  direction: z.enum(["pull", "push"]),
});

/**
 * Sync tags / themes / milestones between TEST and PROD.
 * - pull: peer → local
 * - push: local → peer
 */
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

    if (direction === "pull") {
      const res = await peerFetch("/api/sync/peer/export?resource=catalog", "export");
      if (!res.ok) throw new Error(await res.text());
      const catalog = (await res.json()) as SyncCatalogPayload;
      await upsertCatalog(catalog);
      return NextResponse.json({
        ok: true,
        direction,
        env: getSyncEnv(),
        counts: {
          tags: catalog.tags.length,
          themes: catalog.themes.length,
          milestones: catalog.milestones.length,
        },
      });
    }

    const catalog = await exportCatalog();
    const res = await peerFetch("/api/sync/peer/import", "import", {
      method: "PUT",
      body: JSON.stringify({ type: "catalog", payload: catalog }),
    });
    if (!res.ok) throw new Error(await res.text());
    return NextResponse.json({
      ok: true,
      direction,
      env: getSyncEnv(),
      counts: {
        tags: catalog.tags.length,
        themes: catalog.themes.length,
        milestones: catalog.milestones.length,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Catalog sync failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
