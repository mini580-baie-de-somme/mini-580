import { NextRequest, NextResponse } from "next/server";
import { getEditorOrService } from "@/lib/service-auth";
import {
  MediaBucketError,
  contentTypeFromFilename,
  extensionForContentType,
  getMediaBucket,
  isAllowedContentType,
  normalizeContentType,
} from "@/lib/media-bucket";

export const runtime = "nodejs";

/**
 * POST /api/media — multipart upload (S3 PutObject convenience).
 * Form fields: `file` (required), optional `key`.
 * Auth: session cookie OR Bearer INGEST_API_KEY.
 * Returns { key, url, contentType, contentLength, etag }.
 */
export async function POST(request: NextRequest) {
  const editor = await getEditorOrService(request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file field" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const bucket = getMediaBucket();

    const declared =
      (typeof form.get("contentType") === "string"
        ? (form.get("contentType") as string)
        : null) ||
      file.type ||
      contentTypeFromFilename(file.name) ||
      "";
    const contentType = normalizeContentType(declared);
    if (!isAllowedContentType(contentType)) {
      return NextResponse.json(
        { error: "Unsupported Content-Type (jpeg, png, webp, gif only)" },
        { status: 415 }
      );
    }

    let key =
      typeof form.get("key") === "string" && (form.get("key") as string).trim()
        ? (form.get("key") as string).trim()
        : bucket.createObjectKey(
            file.name || `upload.${extensionForContentType(contentType) ?? "jpg"}`
          );

    // Ensure key extension matches content type
    const expectedExt = extensionForContentType(contentType);
    if (expectedExt && !key.toLowerCase().endsWith(`.${expectedExt}`)) {
      key = `${key.replace(/\.[^.]+$/, "")}.${expectedExt}`;
    }

    const result = await bucket.putObject(key, buffer, contentType);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof MediaBucketError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("media upload failed", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
