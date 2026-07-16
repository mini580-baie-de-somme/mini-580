import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getEditorOrService } from "@/lib/service-auth";
import { slugify } from "@/lib/utils";

export async function GET() {
  const milestones = await prisma.milestone.findMany({
    orderBy: [{ milestoneDate: "asc" }, { sortOrder: "asc" }],
    include: {
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
    },
  });
  return NextResponse.json(milestones);
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
