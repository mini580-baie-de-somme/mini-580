import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getEditorOrService } from "@/lib/service-auth";
import { parseListPagination } from "@/lib/editor-list";
import {
  createExternalLinkSchema,
  externalLinkWhere,
  normalizeExternalLinkUrls,
  serializeExternalLink,
} from "@/lib/external-links";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const { limit, offset, q, paginated } = parseListPagination(searchParams);
  const where = externalLinkWhere(q);

  if (!paginated) {
    const links = await prisma.externalLink.findMany({
      where,
      orderBy: { labelFr: "asc" },
    });
    return NextResponse.json(links);
  }

  const [items, total, totalAll] = await Promise.all([
    prisma.externalLink.findMany({
      where,
      orderBy: { labelFr: "asc" },
      take: limit,
      skip: offset,
    }),
    prisma.externalLink.count({ where }),
    prisma.externalLink.count(),
  ]);

  return NextResponse.json({ items, total, totalAll, limit, offset });
}

export async function POST(request: NextRequest) {
  const editor = await getEditorOrService(request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = createExternalLinkSchema.parse(body);
    const urls = normalizeExternalLinkUrls(data);

    const link = await prisma.externalLink.create({
      data: {
        labelFr: (data.labelFr ?? "").trim(),
        labelEn: (data.labelEn ?? "").trim(),
        url: urls.url,
        urlFr: urls.urlFr,
        urlEn: urls.urlEn,
      },
    });

    return NextResponse.json(serializeExternalLink(link, []), { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create external link" }, { status: 500 });
  }
}
