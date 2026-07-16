import { NextRequest, NextResponse } from "next/server";
import { requireSyncAuth } from "@/lib/sync-crypto";
import { exportCatalog, exportPostById, exportPostSummaries, exportPosts } from "@/lib/sync";

/**
 * Peer-facing export API (OTP required).
 * GET /api/sync/peer/export?resource=posts|summaries|catalog|post&id=
 */
export async function GET(request: NextRequest) {
  try {
    await requireSyncAuth(request, "export");
    const resource = request.nextUrl.searchParams.get("resource") ?? "posts";

    if (resource === "catalog") {
      return NextResponse.json(await exportCatalog());
    }
    if (resource === "summaries") {
      return NextResponse.json(await exportPostSummaries());
    }
    if (resource === "post") {
      const id = request.nextUrl.searchParams.get("id");
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      const post = await exportPostById(id);
      if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json(post);
    }
    return NextResponse.json(await exportPosts());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
