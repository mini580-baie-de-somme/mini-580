import { NextResponse } from "next/server";
import { BE_VERSION } from "@/lib/versions";

export async function GET() {
  return NextResponse.json({ version: BE_VERSION });
}
