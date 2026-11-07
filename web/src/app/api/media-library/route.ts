import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { MediaKind } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getEditorOrService } from "@/lib/service-auth";
import {
  contentTypeFromFilename,
  isAllowedContentType,
  normalizeContentType,
} from "@/lib/media-bucket";
import {
  createMediaFromUpload,
  createMediaFromUrls,
  loadMediaVisibilityContext,
  mediaInclude,
  mediaWhere,
  parseMediaListParams,
  serializeMediaListWithLinks,
  serializeMediaWithLinks,
} from "@/lib/media-library";
import {
  loadReferencedGroupIdSets,
  mediaPublicOnBlogClause,
} from "@/lib/media-post-visibility";
import { enrichMediaListWithIntegrity } from "@/lib/media-integrity";
import { optionalNullableDateTime } from "@/lib/date-schema";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const editor = await getEditorOrService(request);
  const { searchParams } = request.nextUrl;
  const { q, kind, visibility, groupId, limit, offset } = parseMediaListParams(searchParams);
  const baseWhere = await mediaWhere({
    q,
    kind,
    visibility: editor ? visibility : undefined,
    groupId,
  });

  // Public discovery: PostMedia on PUBLISHED or inline group in a published body
  let where = baseWhere;
  let publicTotalWhere = baseWhere;
  if (!editor) {
    const sets = await loadReferencedGroupIdSets();
    const publicClause = mediaPublicOnBlogClause(sets.published);
    where =
      Object.keys(baseWhere).length === 0
        ? publicClause
        : { AND: [baseWhere, publicClause] };
    publicTotalWhere = publicClause;
  }

  const visibilityCtx = editor ? await loadMediaVisibilityContext() : undefined;

  const [rows, total, totalAll] = await Promise.all([
    prisma.media.findMany({
      where,
      include: mediaInclude,
      orderBy: { updatedAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.media.count({ where }),
    prisma.media.count(editor ? undefined : { where: publicTotalWhere }),
  ]);

  const items = editor
    ? serializeMediaListWithLinks(
        await enrichMediaListWithIntegrity(rows),
        visibilityCtx
      )
    : rows;

  return NextResponse.json({ items, total, totalAll, limit, offset });
}

const jsonCreateSchema = z.object({
  kind: z.nativeEnum(MediaKind).optional(),
  mimeType: z.string().optional(),
  urlOrigin: z.string().min(1),
  urlPicto: z.string().nullable().optional(),
  urlPetite: z.string().nullable().optional(),
  urlMoyenne: z.string().nullable().optional(),
  urlGrande: z.string().nullable().optional(),
  titleFr: z.string().optional(),
  titleEn: z.string().optional(),
  descriptionFr: z.string().optional(),
  descriptionEn: z.string().optional(),
  takenAt: optionalNullableDateTime,
});

export async function POST(request: NextRequest) {
  const editor = await getEditorOrService(request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentTypeHeader = request.headers.get("content-type") ?? "";

  try {
    if (contentTypeHeader.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Missing file field" }, { status: 400 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
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
          { error: "Unsupported type (images, PDF, mp4/webm)" },
          { status: 415 }
        );
      }

      const media = await createMediaFromUpload({
        buffer,
        contentType,
        filename: file.name,
        meta: {
          titleFr: String(form.get("titleFr") ?? ""),
          titleEn: String(form.get("titleEn") ?? ""),
          descriptionFr: String(form.get("descriptionFr") ?? ""),
          descriptionEn: String(form.get("descriptionEn") ?? ""),
          takenAt:
            typeof form.get("takenAt") === "string" && (form.get("takenAt") as string)
              ? new Date(form.get("takenAt") as string)
              : null,
        },
      });
      const ctx = await loadMediaVisibilityContext();
      return NextResponse.json(serializeMediaWithLinks(media, ctx), { status: 201 });
    }

    const body = await request.json();
    const data = jsonCreateSchema.parse(body);
    const media = await createMediaFromUrls({
      ...data,
      takenAt: data.takenAt ? new Date(data.takenAt) : null,
    });
    const ctx = await loadMediaVisibilityContext();
    return NextResponse.json(serializeMediaWithLinks(media, ctx), { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to create media";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
