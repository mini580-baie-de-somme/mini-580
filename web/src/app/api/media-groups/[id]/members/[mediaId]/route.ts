import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEditorOrService } from "@/lib/service-auth";
import { getMediaGroupDetail } from "@/lib/media-groups";

type RouteContext = { params: Promise<{ id: string; mediaId: string }> };

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const editor = await getEditorOrService(_request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: groupId, mediaId } = await context.params;
  const group = await prisma.mediaGroup.findUnique({ where: { id: groupId } });
  if (!group) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.mediaGroupMember.deleteMany({
    where: { groupId, mediaId },
  });

  const members = await prisma.mediaGroupMember.findMany({
    where: { groupId },
    orderBy: { sortOrder: "asc" },
  });
  await prisma.$transaction(
    members.map((m, index) =>
      prisma.mediaGroupMember.update({
        where: { groupId_mediaId: { groupId, mediaId: m.mediaId } },
        data: { sortOrder: index },
      })
    )
  );

  const detail = await getMediaGroupDetail(groupId);
  return NextResponse.json(detail);
}
