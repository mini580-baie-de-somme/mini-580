import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getEditorOrService } from "@/lib/service-auth";
import { parseListPagination } from "@/lib/editor-list";
import {
  createMediaGroup,
  createMediaGroupSchema,
  mediaGroupInclude,
  mediaGroupWhere,
  serializeMediaGroup,
} from "@/lib/media-groups";

export async function GET(request: NextRequest) {
  const editor = await getEditorOrService(request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const { limit, offset, q, paginated } = parseListPagination(searchParams);
  const where = mediaGroupWhere(q);

  if (!paginated) {
    const groups = await prisma.mediaGroup.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: mediaGroupInclude,
    });
    return NextResponse.json(groups.map((g) => serializeMediaGroup(g)));
  }

  const [rows, total, totalAll] = await Promise.all([
    prisma.mediaGroup.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: mediaGroupInclude,
      take: limit,
      skip: offset,
    }),
    prisma.mediaGroup.count({ where }),
    prisma.mediaGroup.count(),
  ]);

  return NextResponse.json({
    items: rows.map((g) => serializeMediaGroup(g)),
    total,
    totalAll,
    limit,
    offset,
  });
}

export async function POST(request: NextRequest) {
  const editor = await getEditorOrService(request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = createMediaGroupSchema.parse(body);
    const group = await createMediaGroup(data);
    return NextResponse.json(group, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to create media group";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
