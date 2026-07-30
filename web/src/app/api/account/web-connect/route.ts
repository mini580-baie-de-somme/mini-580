import { NextRequest, NextResponse } from "next/server";
import { createWebConnectLink } from "@/lib/web-connect-link";
import { requireActiveUserFromRequest } from "@/lib/user-auth";

export async function POST(request: NextRequest) {
  const user = await requireActiveUserFromRequest(request);
  if (user === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await createWebConnectLink({
    userId: user.id,
    createdById: user.id,
    selfService: true,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    {
      user: result.user,
      connectUrl: result.connect.connectUrl,
      otpCode: result.connect.otpCode,
      copyPasteMessage: result.connect.copyPasteMessage,
      expiresAt: result.connect.expiresAt,
    },
    { status: 201 }
  );
}
