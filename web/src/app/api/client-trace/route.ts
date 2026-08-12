import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getEditorOrService } from "@/lib/service-auth";
import { appLog } from "@/lib/app-log";

const bodySchema = z.object({
  channel: z.string().default("photo-editor-trace"),
  step: z.string(),
  traceId: z.string().optional(),
  postId: z.string().optional(),
  mediaId: z.string().optional(),
  userAgent: z.string().optional(),
  level: z
    .enum(["trace", "debug", "info", "warn", "error"])
    .default("info"),
  data: z.record(z.string(), z.unknown()).optional(),
});

/** Ingest client-side editor traces so mobile save failures appear in prod logs. */
export async function POST(request: NextRequest) {
  const editor = await getEditorOrService(request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parsed = bodySchema.parse(await request.json());
    appLog(parsed.channel, parsed.level, parsed.step, {
      traceId: parsed.traceId,
      postId: parsed.postId,
      mediaId: parsed.mediaId,
      userAgent: parsed.userAgent,
      editorId: editor.id,
      editorEmail: editor.email,
      source: "client",
      ...(parsed.data ?? {}),
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
