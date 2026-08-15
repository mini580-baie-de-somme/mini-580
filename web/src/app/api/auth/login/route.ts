import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { UserStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  createSessionToken,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/auth";
import { AUTH_INVALID_CREDENTIALS } from "@/lib/auth-messages";
import { appLog } from "@/lib/app-log";
import { isOtpOnlyPasswordHash } from "@/lib/auth-constants";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = loginSchema.parse(body);
    const normalized = email.toLowerCase();

    appLog("auth-login", "info", "attempt", { email: normalized });

    const user = await prisma.user.findUnique({
      where: { email: normalized },
    });
    if (
      !user ||
      user.status !== UserStatus.ACTIVE ||
      isOtpOnlyPasswordHash(user.passwordHash) ||
      !(await verifyPassword(password, user.passwordHash))
    ) {
      appLog("auth-login", "warn", "invalid_credentials", { email: normalized });
      return NextResponse.json(
        { error: AUTH_INVALID_CREDENTIALS },
        { status: 401 }
      );
    }

    const token = await createSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
    });

    appLog("auth-login", "info", "ok", { userId: user.id });

    const response = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name },
    });
    response.cookies.set(sessionCookieOptions(token));
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
