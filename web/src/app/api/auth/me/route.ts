import { NextResponse } from "next/server";
import { getSessionUserFromDb } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUserFromDb();
  return NextResponse.json({ user });
}
