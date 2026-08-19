import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { backfillIncompleteMediaVariants } from "@/lib/media-variant-backfill";
import {
  extractBearerToken,
  isValidIngestApiKey,
} from "@/lib/service-auth";

export const runtime = "nodejs";

const bodySchema = z.object({
  dryRun: z.boolean().optional(),
  limit: z.number().int().positive().max(5000).optional(),
});

/**
 * POST /api/media/backfill-variants
 * Maintenance: fill missing IMAGE variant URLs from on-disk bundles.
 * Auth: Bearer INGEST_API_KEY only.
 */
export async function POST(request: NextRequest) {
  if (!isValidIngestApiKey(extractBearerToken(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema> = {};
  try {
    const raw = await request.text();
    if (raw.trim()) {
      body = bodySchema.parse(JSON.parse(raw));
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await backfillIncompleteMediaVariants(body);
    return NextResponse.json(result);
  } catch (err) {
    console.error("media backfill-variants failed", err);
    return NextResponse.json({ error: "Backfill failed" }, { status: 500 });
  }
}
