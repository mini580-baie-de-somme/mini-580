import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { toAgentMemoryDto } from "@/lib/agent-memory";
import { prisma } from "@/lib/db";
import { getEditorOrService } from "@/lib/service-auth";

type RouteContext = { params: Promise<{ id: string }> };

async function findActive(id: string) {
  return prisma.agentMemoryItem.findFirst({
    where: { id, deletedAt: null },
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  const editor = await getEditorOrService(request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const row = await findActive(id);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(toAgentMemoryDto(row));
}

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  rule: z.string().min(1).max(8000).optional(),
});

export async function PATCH(request: NextRequest, context: RouteContext) {
  const editor = await getEditorOrService(request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await findActive(id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);
    if (data.title === undefined && data.rule === undefined) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const row = await prisma.agentMemoryItem.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title.trim() }),
        ...(data.rule !== undefined && { rule: data.rule.trim() }),
      },
    });
    return NextResponse.json(toAgentMemoryDto(row));
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
  const existing = await findActive(id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.agentMemoryItem.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
