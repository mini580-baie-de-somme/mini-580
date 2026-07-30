import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthOtpPurpose } from "@/generated/prisma/client";
import { hashPassword } from "@/lib/auth";
import { verifyAuthOtp } from "@/lib/auth-otp";
import { prisma } from "@/lib/db";
import { requireActiveUserFromRequest } from "@/lib/user-auth";

const bodySchema = z.object({
  code: z.string().min(4).max(4),
  newPassword: z.string().min(8),
});

export async function POST(request: NextRequest) {
  const user = await requireActiveUserFromRequest(request);
  if (user === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = bodySchema.parse(body);

    const row = await prisma.user.findUnique({
      where: { id: user.id },
      select: { email: true },
    });
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const verified = await verifyAuthOtp({
      email: row.email,
      code: data.code,
      purpose: AuthOtpPurpose.PASSWORD_RESET,
    });
    if (!verified.ok) {
      return NextResponse.json({ error: verified.error }, { status: verified.status });
    }

    if (verified.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const passwordHash = await hashPassword(data.newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    return NextResponse.json({ ok: true, passwordUpdated: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Password update failed" }, { status: 500 });
  }
}
