import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createUserInvite } from "@/lib/user-invite";
import { requireAdminFromRequest } from "@/lib/user-auth";

const inviteSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  isAdmin: z.boolean().optional(),
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
    const data = inviteSchema.parse(body);
    const result = await createUserInvite({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      isAdmin: data.isAdmin,
      createdById: admin.id,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(
      {
        user: result.user,
        inviteTag: result.invite.inviteTag,
        inviteLink: result.invite.inviteLink,
        copyPasteMessage: result.invite.copyPasteMessage,
        expiresAt: result.invite.expiresAt,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
  }
}
