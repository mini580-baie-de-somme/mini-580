import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getEditorOrService } from "@/lib/service-auth";
import { getMediaGroupDetail } from "@/lib/media-groups";

type RouteContext = { params: Promise<{ id: string }> };

const addMemberSchema = z.object({
  mediaId: z.string().min(1),
});

export async function POST(request: NextRequest, context: RouteContext) {
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
    const { mediaId } = addMemberSchema.parse(body);

    const media = await prisma.media.findUnique({ where: { id: mediaId } });
    if (!media) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }

    const existing = await prisma.mediaGroupMember.findUnique({
      where: { groupId_mediaId: { groupId, mediaId } },
    });
    if (existing) {
      const detail = await getMediaGroupDetail(groupId);
      return NextResponse.json(detail);
    }

    const maxOrder = await prisma.mediaGroupMember.aggregate({
      where: { groupId },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

    await prisma.mediaGroupMember.create({
      data: { groupId, mediaId, sortOrder },
    });

    const detail = await getMediaGroupDetail(groupId);
    return NextResponse.json(detail);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Add member failed" }, { status: 500 });
  }
}
