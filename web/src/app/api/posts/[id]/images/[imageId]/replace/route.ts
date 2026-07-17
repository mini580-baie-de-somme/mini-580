import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEditorOrService } from "@/lib/service-auth";
import {
  contentTypeFromFilename,
  isAllowedContentType,
  normalizeContentType,
} from "@/lib/media-bucket";
import { deleteMediaUrls, storeOriginAndVariants } from "@/lib/media-variants";
import { listPostMediaAsImages, mediaAsPostImage } from "@/lib/media-library";

type RouteContext = { params: Promise<{ id: string; imageId: string }> };

/** POST multipart — replace origin and regenerate all variants. */
export async function POST(request: NextRequest, context: RouteContext) {
  const editor = await getEditorOrService(request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: postId, imageId } = await context.params;
  const link = await prisma.postMedia.findUnique({
    where: { postId_mediaId: { postId, mediaId: imageId } },
    include: { media: true },
  });
  if (!link) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const existing = link.media;

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file field" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const declared =
      file.type || contentTypeFromFilename(file.name) || "image/jpeg";
    const ct = normalizeContentType(declared);
    if (!isAllowedContentType(ct)) {
      return NextResponse.json({ error: "Unsupported Content-Type" }, { status: 415 });
    }

    const variants = await storeOriginAndVariants(buffer, ct, file.name);

    await deleteMediaUrls([
      existing.urlOrigin,
      existing.urlPicto,
      existing.urlPetite,
      existing.urlMoyenne,
      existing.urlGrande,
    ]);

    const media = await prisma.media.update({
      where: { id: imageId },
      data: {
        ...variants,
        mimeType: ct,
        byteSize: buffer.byteLength,
      },
    });

    return NextResponse.json(mediaAsPostImage(media, { ...link, postId }));
  } catch (err) {
    console.error("image replace failed", err);
    return NextResponse.json({ error: "Replace failed" }, { status: 500 });
  }
}
