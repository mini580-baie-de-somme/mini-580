import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { getEditorOrService } from "@/lib/service-auth";
import {
  contentTypeFromFilename,
  getMediaBucket,
  isAllowedContentType,
  kindFromContentType,
  normalizeContentType,
  extensionForContentType,
} from "@/lib/media-bucket";
import { MediaKind } from "@/generated/prisma/client";
import { deleteMediaUrls } from "@/lib/media-variants";
import { mediaInclude, rebakeMediaVariants, syncCoverImageUrlsAfterRebake } from "@/lib/media-library";

type RouteContext = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

/** Replace file for a media library item. */
export async function POST(request: NextRequest, context: RouteContext) {
  const editor = await getEditorOrService(request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await prisma.media.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file field" }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const declared =
      file.type || contentTypeFromFilename(file.name) || existing.mimeType;
    const contentType = normalizeContentType(declared);
    if (!isAllowedContentType(contentType)) {
      return NextResponse.json({ error: "Unsupported type" }, { status: 415 });
    }

    const previousUrls = [
      existing.urlOrigin,
      existing.urlPicto,
      existing.urlPetite,
      existing.urlMoyenne,
      existing.urlGrande,
    ];

    const kindHint = kindFromContentType(contentType);
    if (!kindHint) {
      return NextResponse.json({ error: "Unsupported type" }, { status: 415 });
    }

    let urls: {
      urlOrigin: string;
      urlPicto: string | null;
      urlPetite: string | null;
      urlMoyenne: string | null;
      urlGrande: string | null;
    };

    if (kindHint === "IMAGE") {
      const bucket = getMediaBucket();
      const ct = normalizeContentType(contentType);
      const ext = extensionForContentType(ct) ?? "jpg";
      const now = new Date();
      const yyyy = String(now.getUTCFullYear());
      const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
      const uploadId = randomUUID();
      const base = `${yyyy}/${mm}/${uploadId}`;
      const originKey = `${base}/origin.${ext}`;
      const origin = await bucket.putObject(originKey, buffer, ct);
      const variants = await rebakeMediaVariants({
        ...existing,
        urlOrigin: origin.url,
      });
      urls = {
        urlOrigin: origin.url,
        ...variants,
      };
    } else {
      const bucket = getMediaBucket();
      const put = await bucket.putObject(
        bucket.createObjectKey(file.name),
        buffer,
        contentType
      );
      urls = {
        urlOrigin: put.url,
        urlPicto: null,
        urlPetite: null,
        urlMoyenne: null,
        urlGrande: null,
      };
    }

    const updated = await prisma.media.update({
      where: { id },
      data: {
        kind: MediaKind[kindHint],
        mimeType: contentType,
        byteSize: buffer.byteLength,
        urlOrigin: urls.urlOrigin,
        urlPicto: urls.urlPicto,
        urlPetite: urls.urlPetite,
        urlMoyenne: urls.urlMoyenne,
        urlGrande: urls.urlGrande,
      },
      include: mediaInclude,
    });

    if (kindHint === "IMAGE") {
      await syncCoverImageUrlsAfterRebake(id, urls, previousUrls.slice(1));
    }
    await deleteMediaUrls(previousUrls);
    return NextResponse.json(updated);
  } catch (err) {
    console.error("media replace failed", err);
    return NextResponse.json({ error: "Replace failed" }, { status: 500 });
  }
}
