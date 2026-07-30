import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthOtpPurpose } from "@/generated/prisma/client";
import { requestAuthOtp } from "@/lib/auth-otp";

const requestSchema = z.object({
  email: z.string().email(),
  purpose: z.enum(["LOGIN", "PASSWORD_RESET"]),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, purpose } = requestSchema.parse(body);
    const result = await requestAuthOtp({
      email,
      purpose: purpose as AuthOtpPurpose,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "OTP request failed" }, { status: 500 });
  }
}
