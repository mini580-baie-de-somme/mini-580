import { NextRequest, NextResponse } from "next/server";
import { AuthOtpPurpose } from "@/generated/prisma/client";
import { requestAuthOtp } from "@/lib/auth-otp";
import { prisma } from "@/lib/db";
import { requireActiveUserFromRequest } from "@/lib/user-auth";

export async function POST(request: NextRequest) {
  const user = await requireActiveUserFromRequest(request);
  if (user === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true },
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = await requestAuthOtp({
    email: row.email,
    purpose: AuthOtpPurpose.PASSWORD_RESET,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    message:
      "Code de réinitialisation envoyé sur ton Telegram (valide 5 min). Envoie-moi le code + ton nouveau mot de passe, ou saisis-les sur /connexion.",
  });
}
