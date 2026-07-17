import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getEditorOrService } from "@/lib/service-auth";
import { parseListPagination } from "@/lib/editor-list";
import { slugify } from "@/lib/utils";

function tagWhere(q?: string): Prisma.TagWhereInput {
  if (!q) return {};
  return {
    OR: [
      { name: { contains: q, mode: "insensitive" } },
      { labelFr: { contains: q, mode: "insensitive" } },
      { labelEn: { contains: q, mode: "insensitive" } },
    ],
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const { limit, offset, q, paginated } = parseListPagination(searchParams);
  const where = tagWhere(q);

  if (!paginated) {
    const tags = await prisma.tag.findMany({ where, orderBy: { name: "asc" } });
    return NextResponse.json(tags);
  }

  const [items, total, totalAll] = await Promise.all([
    prisma.tag.findMany({
      where,
      orderBy: { name: "asc" },
      take: limit,
      skip: offset,
    }),
    prisma.tag.count({ where }),
    prisma.tag.count(),
  ]);

  return NextResponse.json({ items, total, totalAll, limit, offset });
}

const createTagSchema = z.object({
  labelFr: z.string().min(1),
  labelEn: z.string().min(1),
  name: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const editor = await getEditorOrService(request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = createTagSchema.parse(body);
    const name = data.name ? slugify(data.name) : slugify(data.labelEn);

    const existing = await prisma.tag.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json(existing);
    }

    const tag = await prisma.tag.create({
      data: {
        name,
        labelFr: data.labelFr,
        labelEn: data.labelEn,
      },
    });

    return NextResponse.json(tag, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create tag" }, { status: 500 });
  }
}
