import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireActiveUserFromRequest } from "@/lib/user-auth";
import { deriveUserName } from "@/lib/user-names";
import { toUserDto, userSelect } from "@/lib/users";

export async function GET(request: NextRequest) {
  const user = await requireActiveUserFromRequest(request);
  if (user === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: userSelect,
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(toUserDto(row));
}

const patchSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
});

export async function PATCH(request: NextRequest) {
  const user = await requireActiveUserFromRequest(request);
  if (user === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = patchSchema.parse(body);

    const existing = await prisma.user.findUnique({ where: { id: user.id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const firstName = data.firstName?.trim() ?? existing.firstName;
    const lastName = data.lastName?.trim() ?? existing.lastName;

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(data.email ? { email: data.email.trim().toLowerCase() } : {}),
        ...(data.firstName ? { firstName: data.firstName.trim() } : {}),
        ...(data.lastName ? { lastName: data.lastName.trim() } : {}),
        name: deriveUserName(firstName, lastName) ?? existing.name,
      },
      select: userSelect,
    });

    return NextResponse.json(toUserDto(updated));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update account" }, { status: 500 });
  }
}
