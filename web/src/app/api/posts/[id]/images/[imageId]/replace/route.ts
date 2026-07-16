import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEditorOrService } from "@/lib/service-auth";
import {
  contentTypeFromFilename,
  isAllowedContentType,
  normalizeContentType,
} from "@/lib/media-bucket";
import { deleteMediaUrls, storeOriginAndVariants } from "@/lib/media-variants";

type RouteContext = { params: Promise<{ id: string; imageId: string }> };

/** POST multipart — replace origin and regenerate all variants. */
export async function POST(request: NextRequest, context: RouteContext) {
  const editor = await getEditorOrService(request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: postId, imageId } = await context.params;
  const existing = await prisma.postImage.findFirst({
    where: { id: imageId, postId },
  });
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

    const image = await prisma.postImage.update({
      where: { id: imageId },
      data: variants,
    });

    return NextResponse.json(image);
  } catch (err) {
    console.error("image replace failed", err);
    return NextResponse.json({ error: "Replace failed" }, { status: 500 });
  }
}
