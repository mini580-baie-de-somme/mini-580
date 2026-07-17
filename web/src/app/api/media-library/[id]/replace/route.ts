import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEditorOrService } from "@/lib/service-auth";
import {
  contentTypeFromFilename,
  getMediaBucket,
  isAllowedContentType,
  kindFromContentType,
  normalizeContentType,
} from "@/lib/media-bucket";
import { MediaKind } from "@/generated/prisma/client";
import { storeOriginAndVariants, deleteMediaUrls } from "@/lib/media-variants";
import { mediaInclude } from "@/lib/media-library";

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
      urls = await storeOriginAndVariants(buffer, contentType, file.name);
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

    await deleteMediaUrls(previousUrls);
    return NextResponse.json(updated);
  } catch (err) {
    console.error("media replace failed", err);
    return NextResponse.json({ error: "Replace failed" }, { status: 500 });
  }
}
