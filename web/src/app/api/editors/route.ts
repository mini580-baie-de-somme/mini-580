import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listPlatformEditors } from "@/lib/editors";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const editors = await listPlatformEditors();
  return NextResponse.json(editors);
}
