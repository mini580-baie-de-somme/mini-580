import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSyncEnv, isSyncConfigured, peerFetch } from "@/lib/sync-crypto";
import {
  applyProdPostsToTest,
  upsertCatalog,
  type SyncCatalogPayload,
  type SyncPostPayload,
} from "@/lib/sync";

/**
 * Pull PROD → TEST:
 * - overwrite matching post IDs from PROD
 * - keep TEST-only posts
 * Also pulls catalog (tags, themes, milestones).
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
    const catalogRes = await peerFetch(
      "/api/sync/peer/export?resource=catalog",
      "export"
    );
    if (!catalogRes.ok) {
      throw new Error(`Catalog export failed: ${await catalogRes.text()}`);
    }
    const catalog = (await catalogRes.json()) as SyncCatalogPayload;
    await upsertCatalog(catalog);

    const postsRes = await peerFetch("/api/sync/peer/export?resource=posts", "export");
    if (!postsRes.ok) {
      throw new Error(`Posts export failed: ${await postsRes.text()}`);
    }
    const posts = (await postsRes.json()) as SyncPostPayload[];
    const result = await applyProdPostsToTest(posts);

    return NextResponse.json({
      ok: true,
      catalog: {
        tags: catalog.tags.length,
        themes: catalog.themes.length,
        milestones: catalog.milestones.length,
      },
      posts: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pull failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
