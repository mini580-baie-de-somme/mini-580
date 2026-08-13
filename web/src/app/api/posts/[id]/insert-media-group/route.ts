import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getEditorOrService } from "@/lib/service-auth";
import { insertMediaGroupInPost, insertMediaGroupSchema } from "@/lib/insert-media-group";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const editor = await getEditorOrService(request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const input = insertMediaGroupSchema.parse(body);
    const result = await insertMediaGroupInPost(id, input);

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  }
}
