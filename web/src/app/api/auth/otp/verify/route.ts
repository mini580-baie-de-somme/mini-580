import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthOtpPurpose } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  createSessionToken,
  hashPassword,
  sessionCookieOptions,
} from "@/lib/auth";
import { verifyAuthOtp } from "@/lib/auth-otp";

const verifySchema = z.object({
  email: z.string().email(),
  code: z.string().min(4).max(4),
  purpose: z.enum(["LOGIN", "PASSWORD_RESET"]),
  newPassword: z.string().min(8).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = verifySchema.parse(body);
    const purpose = data.purpose as AuthOtpPurpose;

    if (purpose === AuthOtpPurpose.PASSWORD_RESET && !data.newPassword) {
      return NextResponse.json(
        { error: "newPassword required for PASSWORD_RESET" },
        { status: 400 }
      );
    }

    const verified = await verifyAuthOtp({
      email: data.email,
      code: data.code,
      purpose,
    });
    if (!verified.ok) {
      return NextResponse.json({ error: verified.error }, { status: verified.status });
    }

    if (purpose === AuthOtpPurpose.PASSWORD_RESET) {
      const passwordHash = await hashPassword(data.newPassword!);
      await prisma.user.update({
        where: { id: verified.userId },
        data: { passwordHash },
      });
      return NextResponse.json({ ok: true, passwordUpdated: true });
    }

    const token = await createSessionToken({
      id: verified.userId,
      email: verified.email,
      name: verified.name,
    });
    const response = NextResponse.json({
      user: {
        id: verified.userId,
        email: verified.email,
        name: verified.name,
      },
    });
    response.cookies.set(sessionCookieOptions(token));
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "OTP verify failed" }, { status: 500 });
  }
}
