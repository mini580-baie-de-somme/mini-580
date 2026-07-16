import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getEditorOrService } from "@/lib/service-auth";
import { slugify } from "@/lib/utils";

type RouteContext = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  labelFr: z.string().min(1).optional(),
  labelEn: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
});

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const tag = await prisma.tag.findUnique({ where: { id } });
  if (!tag) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(tag);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const editor = await getEditorOrService(request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);

    const tag = await prisma.tag.update({
      where: { id },
      data: {
        ...(data.labelFr !== undefined && { labelFr: data.labelFr }),
        ...(data.labelEn !== undefined && { labelEn: data.labelEn }),
        ...(data.name !== undefined && { name: slugify(data.name) }),
      },
    });

    return NextResponse.json(tag);
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
  await prisma.tag.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
