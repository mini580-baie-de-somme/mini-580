import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getEditorOrService } from "@/lib/service-auth";
import { requiredDateTime } from "@/lib/date-schema";

type RouteContext = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  titleFr: z.string().optional(),
  titleEn: z.string().optional(),
  descriptionFr: z.string().optional(),
  descriptionEn: z.string().optional(),
  milestoneDate: requiredDateTime.optional(),
  slug: z.string().optional(),
});

export async function PATCH(request: NextRequest, context: RouteContext) {
  const editor = await getEditorOrService(request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);

    const milestone = await prisma.milestone.update({
      where: { id },
      data: {
        ...(data.titleFr !== undefined && { titleFr: data.titleFr }),
        ...(data.titleEn !== undefined && { titleEn: data.titleEn }),
        ...(data.descriptionFr !== undefined && { descriptionFr: data.descriptionFr }),
        ...(data.descriptionEn !== undefined && { descriptionEn: data.descriptionEn }),
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.milestoneDate !== undefined && {
          milestoneDate: new Date(data.milestoneDate),
        }),
      },
    });

    return NextResponse.json(milestone);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const editor = await getEditorOrService(request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  await prisma.milestone.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
