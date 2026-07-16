import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getEditorOrService } from "@/lib/service-auth";
import { slugify } from "@/lib/utils";

export async function GET() {
  const tags = await prisma.tag.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(tags);
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
