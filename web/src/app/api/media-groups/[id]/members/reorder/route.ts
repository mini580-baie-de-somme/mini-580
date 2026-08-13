import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getEditorOrService } from "@/lib/service-auth";
import { getMediaGroupDetail, replaceMediaGroupMembers } from "@/lib/media-groups";

type RouteContext = { params: Promise<{ id: string }> };

const reorderSchema = z.object({
  mediaIds: z.array(z.string()).min(1),
});

export async function PUT(request: NextRequest, context: RouteContext) {
  const editor = await getEditorOrService(request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: groupId } = await context.params;
  const group = await prisma.mediaGroup.findUnique({ where: { id: groupId } });
  if (!group) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { mediaIds } = reorderSchema.parse(body);

    const current = await prisma.mediaGroupMember.findMany({
      where: { groupId },
      select: { mediaId: true },
    });
    const currentSet = new Set(current.map((m) => m.mediaId));
    const incomingSet = new Set(mediaIds);

    if (currentSet.size !== incomingSet.size || mediaIds.some((id) => !currentSet.has(id))) {
      return NextResponse.json(
        { error: "mediaIds must match current group members exactly" },
        { status: 400 }
      );
    }

    await replaceMediaGroupMembers(groupId, mediaIds);
    const detail = await getMediaGroupDetail(groupId);
    return NextResponse.json(detail);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Reorder failed" }, { status: 500 });
  }
}
