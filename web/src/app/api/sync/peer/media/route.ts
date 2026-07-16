import { NextRequest, NextResponse } from "next/server";
import {
  assertSafeMediaKey,
  getMediaBucket,
  isAllowedContentType,
  MEDIA_MAX_BYTES,
  normalizeContentType,
} from "@/lib/media-bucket";
import { requireSyncAuth } from "@/lib/sync-crypto";
import { sha256Hex } from "@/lib/sync-media";

/**
 * GET /api/sync/peer/media?key=… — export binary (OTP media_export)
 * Headers: Content-Type, X-Content-Sha256, Content-Length
 */
export async function GET(request: NextRequest) {
  try {
    await requireSyncAuth(request, "media_export");
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keyParam = request.nextUrl.searchParams.get("key");
  if (!keyParam) {
    return NextResponse.json({ error: "key required" }, { status: 400 });
  }

  try {
    const key = assertSafeMediaKey(keyParam);
    const obj = await getMediaBucket().getObject(key);
    if (!obj) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const checksum = sha256Hex(obj.body);
    return new NextResponse(new Uint8Array(obj.body), {
      status: 200,
      headers: {
        "Content-Type": obj.contentType,
        "Content-Length": String(obj.contentLength),
        "X-Content-Sha256": checksum,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/**
 * POST /api/sync/peer/media — import multipart (OTP media_import)
 * Fields: file, key, checksum (sha256 hex), contentType
 */
export async function POST(request: NextRequest) {
  try {
    await requireSyncAuth(request, "media_import");
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    const keyRaw = form.get("key");
    const checksumRaw = form.get("checksum");
    const contentTypeRaw = form.get("contentType");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (typeof keyRaw !== "string" || !keyRaw.trim()) {
      return NextResponse.json({ error: "Missing key" }, { status: 400 });
    }
    if (typeof checksumRaw !== "string" || !checksumRaw.trim()) {
      return NextResponse.json({ error: "Missing checksum" }, { status: 400 });
    }

    const key = assertSafeMediaKey(keyRaw.trim());
    const body = Buffer.from(await file.arrayBuffer());
    if (body.byteLength === 0 || body.byteLength > MEDIA_MAX_BYTES) {
      return NextResponse.json({ error: "Invalid file size" }, { status: 413 });
    }

    const actual = sha256Hex(body);
    const expected = checksumRaw.trim().toLowerCase();
    if (actual !== expected) {
      return NextResponse.json(
        { error: `Checksum mismatch: expected ${expected}, got ${actual}` },
        { status: 400 }
      );
    }

    const contentType = normalizeContentType(
      (typeof contentTypeRaw === "string" && contentTypeRaw) ||
        file.type ||
        "application/octet-stream"
    );
    // Allow image types; also allow octet-stream if checksum OK (variants are webp)
    if (
      !isAllowedContentType(contentType) &&
      contentType !== "application/octet-stream" &&
      contentType !== "image/webp"
    ) {
      // webp is in ALLOWED; octet-stream fallback for safety
      if (!contentType.startsWith("image/")) {
        return NextResponse.json(
          { error: "Unsupported Content-Type" },
          { status: 415 }
        );
      }
    }

    const stored = await getMediaBucket().putObject(
      key,
      body,
      contentType === "application/octet-stream" ? "image/webp" : contentType
    );

    return NextResponse.json({
      key: stored.key,
      url: stored.url,
      checksum: actual,
      contentType: stored.contentType,
      contentLength: stored.contentLength,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
