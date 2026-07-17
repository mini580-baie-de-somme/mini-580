import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getEditorOrService } from "@/lib/service-auth";
import { parseListPagination } from "@/lib/editor-list";
import { slugify } from "@/lib/utils";

const milestoneInclude = {
  posts: {
    include: {
      post: {
        select: {
          id: true,
          slug: true,
          titleFr: true,
          titleEn: true,
          status: true,
          publishedAt: true,
        },
      },
    },
  },
} satisfies Prisma.MilestoneInclude;

function milestoneWhere(q?: string): Prisma.MilestoneWhereInput {
  if (!q) return {};
  return {
    OR: [
      { slug: { contains: q, mode: "insensitive" } },
      { titleFr: { contains: q, mode: "insensitive" } },
      { titleEn: { contains: q, mode: "insensitive" } },
      { descriptionFr: { contains: q, mode: "insensitive" } },
      { descriptionEn: { contains: q, mode: "insensitive" } },
    ],
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const { limit, offset, q, paginated } = parseListPagination(searchParams);
  const where = milestoneWhere(q);
  const orderBy = [
    { milestoneDate: "asc" as const },
    { sortOrder: "asc" as const },
  ];

  if (!paginated) {
    const milestones = await prisma.milestone.findMany({
      where,
      orderBy,
      include: milestoneInclude,
    });
    return NextResponse.json(milestones);
  }

  const [items, total, totalAll] = await Promise.all([
    prisma.milestone.findMany({
      where,
      orderBy,
      include: milestoneInclude,
      take: limit,
      skip: offset,
    }),
    prisma.milestone.count({ where }),
    prisma.milestone.count(),
  ]);

  return NextResponse.json({ items, total, totalAll, limit, offset });
}

const createSchema = z.object({
  titleFr: z.string().min(1),
  titleEn: z.string().min(1),
  descriptionFr: z.string().optional(),
  descriptionEn: z.string().optional(),
  milestoneDate: z.string().datetime().or(z.string()),
  sortOrder: z.number().int().optional(),
  slug: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const editor = await getEditorOrService(request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = createSchema.parse(body);
    let slug = data.slug ?? slugify(data.titleEn);
    let n = 0;
    while (await prisma.milestone.findUnique({ where: { slug } })) {
      n += 1;
      slug = `${data.slug ?? slugify(data.titleEn)}-${n}`;
    }

    const milestone = await prisma.milestone.create({
      data: {
        slug,
        titleFr: data.titleFr,
        titleEn: data.titleEn,
        descriptionFr: data.descriptionFr ?? "",
        descriptionEn: data.descriptionEn ?? "",
        milestoneDate: new Date(data.milestoneDate),
        sortOrder: data.sortOrder ?? 0,
      },
    });

    return NextResponse.json(milestone, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create milestone" }, { status: 500 });
  }
}
