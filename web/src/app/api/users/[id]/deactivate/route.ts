import { NextRequest, NextResponse } from "next/server";
import { UserStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireAdminFromRequest } from "@/lib/user-auth";
import { toUserDto, userSelect } from "@/lib/users";

async function updateStatus(
  request: NextRequest,
  id: string,
  status: UserStatus
) {
  const admin = await requireAdminFromRequest(request);
  if (admin === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (admin === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await prisma.user.update({
    where: { id },
    data: { status },
    select: userSelect,
  });

  return NextResponse.json(toUserDto(user));
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return updateStatus(request, id, UserStatus.INACTIVE);
}
