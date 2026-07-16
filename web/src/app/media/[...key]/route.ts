import { NextRequest, NextResponse } from "next/server";
import {
  MediaBucketError,
  getMediaBucket,
} from "@/lib/media-bucket";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ key: string[] }> };

/**
 * GET /media/{key} — public object download (S3 GetObject).
 * On VPS, nginx may short-circuit this with an alias to the bind-mounted disk.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { key: parts } = await context.params;
    const key = parts.map((p) => decodeURIComponent(p)).join("/");
    const obj = await getMediaBucket().getObject(key);
    if (!obj) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(obj.body), {
      status: 200,
      headers: {
        "Content-Type": obj.contentType,
        "Content-Length": String(obj.contentLength),
        ETag: obj.etag,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    if (err instanceof MediaBucketError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("media get failed", err);
    return NextResponse.json({ error: "Get failed" }, { status: 500 });
  }
}

export async function HEAD(_request: NextRequest, context: RouteContext) {
  try {
    const { key: parts } = await context.params;
    const key = parts.map((p) => decodeURIComponent(p)).join("/");
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
