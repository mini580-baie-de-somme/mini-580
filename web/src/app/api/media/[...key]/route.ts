import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  MediaBucketError,
  getMediaBucket,
  isAllowedContentType,
  normalizeContentType,
} from "@/lib/media-bucket";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ key: string[] }> };

function keyFromParams(parts: string[]): string {
  return parts.map((p) => decodeURIComponent(p)).join("/");
}

/**
 * PUT /api/media/{key} — S3 PutObject (raw body + Content-Type).
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { key: parts } = await context.params;
    const key = keyFromParams(parts);
    const contentType = normalizeContentType(
      request.headers.get("content-type") || ""
    );
    if (!isAllowedContentType(contentType)) {
      return NextResponse.json(
        { error: "Unsupported Content-Type (jpeg, png, webp, gif only)" },
        { status: 415 }
      );
    }

    const buffer = Buffer.from(await request.arrayBuffer());
    const result = await getMediaBucket().putObject(key, buffer, contentType);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof MediaBucketError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("media put failed", err);
    return NextResponse.json({ error: "Put failed" }, { status: 500 });
  }
}

/**
 * DELETE /api/media/{key} — S3 DeleteObject.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { key: parts } = await context.params;
    const key = keyFromParams(parts);
    await getMediaBucket().deleteObject(key);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof MediaBucketError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("media delete failed", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}

/**
 * HEAD /api/media/{key} — S3 HeadObject (auth not required; public reads).
 */
export async function HEAD(_request: NextRequest, context: RouteContext) {
  try {
    const { key: parts } = await context.params;
    const key = keyFromParams(parts);
    const meta = await getMediaBucket().headObject(key);
    if (!meta) {
      return new NextResponse(null, { status: 404 });
    }
    return new NextResponse(null, {
      status: 200,
      headers: {
        "Content-Type": meta.contentType,
        "Content-Length": String(meta.contentLength),
        ETag: meta.etag,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    if (err instanceof MediaBucketError) {
      return new NextResponse(null, { status: err.status });
    }
    return new NextResponse(null, { status: 500 });
  }
}
