import { NextRequest, NextResponse } from "next/server";
import { createWebConnectLink } from "@/lib/web-connect-link";
import { requireAdminFromRequest } from "@/lib/user-auth";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const admin = await requireAdminFromRequest(request);
  if (admin === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (admin === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const result = await createWebConnectLink({
    userId: id,
    createdById: admin.id,
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
