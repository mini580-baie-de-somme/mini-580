import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { UserStatus } from "@/generated/prisma/client";
import { OTP_ONLY_PASSWORD_HASH } from "@/lib/auth-constants";
import { prisma } from "@/lib/db";
import { requireAdminFromRequest } from "@/lib/user-auth";
import { deriveUserName } from "@/lib/user-names";
import { toUserDto, userSelect } from "@/lib/users";

export async function GET(request: NextRequest) {
  const admin = await requireAdminFromRequest(request);
  if (admin === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (admin === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const includeArchived =
    request.nextUrl.searchParams.get("includeArchived") === "true";

  const users = await prisma.user.findMany({
    where: includeArchived ? {} : { status: { not: UserStatus.ARCHIVED } },
    select: userSelect,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { email: "asc" }],
  });

  return NextResponse.json(users.map(toUserDto));
}

const createSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  telegramUserId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const admin = await requireAdminFromRequest(request);
  if (admin === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (admin === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = createSchema.parse(body);
    const email = data.email.trim().toLowerCase();
    const name = deriveUserName(data.firstName, data.lastName);

    const user = await prisma.user.create({
      data: {
        email,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        name,
        telegramUserId: data.telegramUserId.trim(),
        passwordHash: OTP_ONLY_PASSWORD_HASH,
        status: UserStatus.ACTIVE,
        isAdmin: false,
      },
      select: userSelect,
    });

    return NextResponse.json(toUserDto(user), { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
