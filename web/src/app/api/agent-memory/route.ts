import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  listActiveAgentMemoryItems,
  toAgentMemoryDto,
} from "@/lib/agent-memory";
import { prisma } from "@/lib/db";
import { parseListPagination } from "@/lib/editor-list";
import { getEditorOrService } from "@/lib/service-auth";

export async function GET(request: NextRequest) {
  const editor = await getEditorOrService(request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const { limit, offset, q, paginated } = parseListPagination(searchParams);

  if (!paginated) {
    const { items } = await listActiveAgentMemoryItems({ q, limit: 500, offset: 0 });
    return NextResponse.json(items);
  }

  const page = await listActiveAgentMemoryItems({ q, limit, offset });
  return NextResponse.json(page);
}

const createSchema = z.object({
  title: z.string().min(1).max(200),
  rule: z.string().min(1).max(8000),
});

export async function POST(request: NextRequest) {
  const editor = await getEditorOrService(request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = createSchema.parse(body);
    const row = await prisma.agentMemoryItem.create({
      data: {
        title: data.title.trim(),
        rule: data.rule.trim(),
      },
    });
    return NextResponse.json(toAgentMemoryDto(row), { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create memory item" }, { status: 500 });
  }
}
