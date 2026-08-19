import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getEditorOrService } from "@/lib/service-auth";
import {
  findPostsReferencingExternalLink,
  getExternalLinkDetail,
  normalizeExternalLinkUrls,
  updateExternalLinkSchema,
} from "@/lib/external-links";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const editor = await getEditorOrService(_request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const link = await getExternalLinkDetail(id);
  if (!link) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(link);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const editor = await getEditorOrService(request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await prisma.externalLink.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const data = updateExternalLinkSchema.parse(body);

    const merged = {
      labelFr: data.labelFr !== undefined ? data.labelFr.trim() : existing.labelFr,
      labelEn: data.labelEn !== undefined ? data.labelEn.trim() : existing.labelEn,
      url: data.url !== undefined ? data.url : existing.url,
      urlFr: data.urlFr !== undefined ? data.urlFr : existing.urlFr,
      urlEn: data.urlEn !== undefined ? data.urlEn : existing.urlEn,
    };

    const urls =
      data.url !== undefined || data.urlFr !== undefined || data.urlEn !== undefined
        ? normalizeExternalLinkUrls(merged)
        : {
            url: existing.url,
            urlFr: existing.urlFr,
            urlEn: existing.urlEn,
          };

    await prisma.externalLink.update({
      where: { id },
      data: {
        ...(data.labelFr !== undefined && { labelFr: merged.labelFr }),
        ...(data.labelEn !== undefined && { labelEn: merged.labelEn }),
        ...(data.url !== undefined || data.urlFr !== undefined || data.urlEn !== undefined
          ? urls
          : {}),
      },
    });

    const link = await getExternalLinkDetail(id);
    return NextResponse.json(link);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const editor = await getEditorOrService(_request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await prisma.externalLink.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const refs = await findPostsReferencingExternalLink(id);
  if (refs.length > 0) {
    return NextResponse.json(
      {
        error: "External link is referenced in article bodies — remove placeholders first",
        referencedByPostIds: refs.map((p) => p.id),
        referencedByPosts: refs,
      },
      { status: 409 }
    );
  }

  await prisma.externalLink.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
