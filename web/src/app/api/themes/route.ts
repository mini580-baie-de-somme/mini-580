import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getEditorOrService } from "@/lib/service-auth";
import { slugify } from "@/lib/utils";

export async function GET() {
  const themes = await prisma.theme.findMany({ orderBy: { slug: "asc" } });
  return NextResponse.json(themes);
}

const createThemeSchema = z.object({
  labelFr: z.string().min(1),
  labelEn: z.string().min(1),
  slug: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const editor = await getEditorOrService(request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = createThemeSchema.parse(body);
    let slug = data.slug ? slugify(data.slug) : slugify(data.labelEn);
    let n = 0;
    while (await prisma.theme.findUnique({ where: { slug } })) {
      n += 1;
      slug = `${data.slug ? slugify(data.slug) : slugify(data.labelEn)}-${n}`;
    }

    const theme = await prisma.theme.create({
      data: {
        slug,
        labelFr: data.labelFr,
        labelEn: data.labelEn,
      },
    });

    return NextResponse.json(theme, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create theme" }, { status: 500 });
  }
}
