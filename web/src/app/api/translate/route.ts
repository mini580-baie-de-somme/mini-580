import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getEditorOrService } from "@/lib/service-auth";
import {
  isTranslationConfigured,
  translateArticleToEn,
  translateImagesToEn,
} from "@/lib/translate";

const articleSchema = z.object({
  kind: z.literal("article"),
  titleFr: z.string().min(1),
  excerptFr: z.string().optional(),
  bodyFr: z.string(),
  newTags: z.array(z.object({ labelFr: z.string() })).optional(),
});

const imagesSchema = z.object({
  kind: z.literal("images"),
  images: z.array(
    z.object({
      titleFr: z.string(),
      captionFr: z.string(),
    })
  ),
});

const bodySchema = z.discriminatedUnion("kind", [articleSchema, imagesSchema]);

export async function POST(request: NextRequest) {
  const editor = await getEditorOrService(request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isTranslationConfigured()) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 503 }
    );
  }

  try {
    const json = await request.json();
    const normalized =
      json && typeof json === "object" && "kind" in json
        ? json
        : Array.isArray(json?.images)
          ? { kind: "images" as const, ...json }
          : { kind: "article" as const, ...json };
    const data = bodySchema.parse(normalized);

    if (data.kind === "images") {
      const result = await translateImagesToEn(data);
      return NextResponse.json(result);
    }

    const result = await translateArticleToEn(data);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    console.error("translate failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Translate failed" },
      { status: 500 }
    );
  }
}
