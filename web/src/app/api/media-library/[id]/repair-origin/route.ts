import { NextRequest, NextResponse } from "next/server";
import { getEditorOrService } from "@/lib/service-auth";
import { repairMediaOriginFromLocalVariant } from "@/lib/media-origin-repair";

type RouteContext = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

/** Restore missing local origin from the largest on-disk variant (explicit repair). */
export async function POST(_request: NextRequest, context: RouteContext) {
  const editor = await getEditorOrService(_request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    const media = await repairMediaOriginFromLocalVariant(id);
    return NextResponse.json(media);
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    const message = err instanceof Error ? err.message : "Repair failed";
    if (name === "MediaIntegrityError") {
      return NextResponse.json({ error: message }, { status: 422 });
    }
    if (message === "Media not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error("origin repair failed", err);
    return NextResponse.json({ error: "Repair failed" }, { status: 500 });
  }
}
