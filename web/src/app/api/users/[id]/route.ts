import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdminFromRequest } from "@/lib/user-auth";
import { deriveUserName } from "@/lib/user-names";
import { toUserDto, userSelect } from "@/lib/users";

const patchSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  telegramUserId: z.string().min(1).optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdminFromRequest(request);
  if (admin === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (admin === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const data = patchSchema.parse(body);

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const firstName = data.firstName?.trim() ?? existing.firstName;
    const lastName = data.lastName?.trim() ?? existing.lastName;

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(data.email ? { email: data.email.trim().toLowerCase() } : {}),
        ...(data.firstName ? { firstName: data.firstName.trim() } : {}),
        ...(data.lastName ? { lastName: data.lastName.trim() } : {}),
        ...(data.telegramUserId
          ? { telegramUserId: data.telegramUserId.trim() }
          : {}),
        name: deriveUserName(firstName, lastName) ?? existing.name,
      },
      select: userSelect,
    });

    return NextResponse.json(toUserDto(user));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
