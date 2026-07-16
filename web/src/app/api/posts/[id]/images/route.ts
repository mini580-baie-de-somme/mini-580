import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getEditorOrService } from "@/lib/service-auth";
import { postInclude } from "@/lib/posts";
import {
  contentTypeFromFilename,
  isAllowedContentType,
  normalizeContentType,
} from "@/lib/media-bucket";
import { storeOriginAndVariants } from "@/lib/media-variants";

type RouteContext = { params: Promise<{ id: string }> };

const imageMetaSchema = z.object({
  urlOrigin: z.string().min(1).optional(),
  urlPicto: z.string().nullable().optional(),
  urlPetite: z.string().nullable().optional(),
  urlMoyenne: z.string().nullable().optional(),
  urlGrande: z.string().nullable().optional(),
  titleFr: z.string().optional(),
  titleEn: z.string().optional(),
  descriptionFr: z.string().optional(),
  descriptionEn: z.string().optional(),
  /** @deprecated use descriptionFr */
  captionFr: z.string().optional(),
  /** @deprecated use descriptionEn */
  captionEn: z.string().optional(),
  /** @deprecated use urlOrigin */
  url: z.string().optional(),
  takenAt: z.string().datetime().nullable().optional(),
  sortOrder: z.number().int().optional(),
  focusX: z.number().min(0).max(1).optional(),
  focusY: z.number().min(0).max(1).optional(),
  zoom: z.number().min(0.1).max(5).optional(),
  rotation: z.number().int().optional(),
  cropX: z.number().min(0).max(1).optional(),
  cropY: z.number().min(0).max(1).optional(),
  cropW: z.number().min(0).max(1).optional(),
  cropH: z.number().min(0).max(1).optional(),
});

const replaceAllSchema = z.object({
  images: z.array(imageMetaSchema.extend({ urlOrigin: z.string().min(1).optional(), url: z.string().optional() })),
});

function resolveDescriptions(img: z.infer<typeof imageMetaSchema>) {
  return {
    descriptionFr: img.descriptionFr ?? img.captionFr ?? "",
    descriptionEn: img.descriptionEn ?? img.captionEn ?? "",
  };
}

function resolveOrigin(img: z.infer<typeof imageMetaSchema>) {
  return img.urlOrigin ?? img.url ?? "";
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id: postId } = await context.params;
  const images = await prisma.postImage.findMany({
    where: { postId },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(images);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const editor = await getEditorOrService(request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: postId } = await context.params;
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const data = replaceAllSchema.parse(body);

    await prisma.postImage.deleteMany({ where: { postId } });
    if (data.images.length) {
      await prisma.postImage.createMany({
        data: data.images.map((img, i) => {
          const origin = resolveOrigin(img);
          const desc = resolveDescriptions(img);
          return {
            postId,
            urlOrigin: origin,
            urlPicto: img.urlPicto ?? null,
            urlPetite: img.urlPetite ?? null,
            urlMoyenne: img.urlMoyenne ?? origin,
            urlGrande: img.urlGrande ?? null,
            titleFr: img.titleFr ?? "",
            titleEn: img.titleEn ?? "",
            descriptionFr: desc.descriptionFr,
            descriptionEn: desc.descriptionEn,
            takenAt: img.takenAt ? new Date(img.takenAt) : null,
            sortOrder: img.sortOrder ?? i,
            focusX: img.focusX ?? 0.5,
            focusY: img.focusY ?? 0.5,
            zoom: img.zoom ?? 1,
            rotation: img.rotation ?? 0,
            cropX: img.cropX ?? 0,
            cropY: img.cropY ?? 0,
            cropW: img.cropW ?? 1,
            cropH: img.cropH ?? 1,
          };
        }),
      });
    }

    const full = await prisma.post.findUnique({
      where: { id: postId },
      include: postInclude,
    });
    return NextResponse.json(full);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update images" }, { status: 500 });
  }
}

/** Create PostImage from already-stored URLs (JSON). Prefer POST .../upload for files. */
export async function POST(request: NextRequest, context: RouteContext) {
  const editor = await getEditorOrService(request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: postId } = await context.params;
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    return uploadMultipart(request, postId);
  }

  try {
    const body = await request.json();
    const data = imageMetaSchema.parse(body);
    const origin = resolveOrigin(data);
    if (!origin) {
      return NextResponse.json({ error: "urlOrigin required" }, { status: 400 });
    }
    const desc = resolveDescriptions(data);
    const max = await prisma.postImage.aggregate({
      where: { postId },
      _max: { sortOrder: true },
    });

    const image = await prisma.postImage.create({
      data: {
        postId,
        urlOrigin: origin,
        urlPicto: data.urlPicto ?? null,
        urlPetite: data.urlPetite ?? null,
        urlMoyenne: data.urlMoyenne ?? origin,
        urlGrande: data.urlGrande ?? null,
        titleFr: data.titleFr ?? "",
        titleEn: data.titleEn ?? "",
        descriptionFr: desc.descriptionFr,
        descriptionEn: desc.descriptionEn,
        takenAt: data.takenAt ? new Date(data.takenAt) : null,
        sortOrder: data.sortOrder ?? (max._max.sortOrder ?? -1) + 1,
        focusX: data.focusX ?? 0.5,
        focusY: data.focusY ?? 0.5,
        zoom: data.zoom ?? 1,
        rotation: data.rotation ?? 0,
        cropX: data.cropX ?? 0,
        cropY: data.cropY ?? 0,
        cropW: data.cropW ?? 1,
        cropH: data.cropH ?? 1,
      },
    });

    return NextResponse.json(image, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create image" }, { status: 500 });
  }
}

async function uploadMultipart(request: NextRequest, postId: string) {
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
    const max = await prisma.postImage.aggregate({
      where: { postId },
      _max: { sortOrder: true },
    });

    const titleFr = typeof form.get("titleFr") === "string" ? String(form.get("titleFr")) : "";
    const descriptionFr =
      typeof form.get("descriptionFr") === "string"
        ? String(form.get("descriptionFr"))
        : "";

    const image = await prisma.postImage.create({
      data: {
        postId,
        ...variants,
        titleFr,
        titleEn: "",
        descriptionFr,
        descriptionEn: "",
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
    });

    return NextResponse.json(image, { status: 201 });
  } catch (err) {
    console.error("image upload failed", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
