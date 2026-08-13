import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEditorOrService } from "@/lib/service-auth";
import {
  buildArticleMediaManifest,
  serializeMediaManifestResponse,
} from "@/lib/article-media-manifest";
import { postInclude } from "@/lib/posts";

type RouteContext = { params: Promise<{ id: string }> };

function parseLocale(value: string | null): "fr" | "en" {
  return value?.toLowerCase() === "en" ? "en" : "fr";
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const editor = await getEditorOrService(request);
  const locale = parseLocale(request.nextUrl.searchParams.get("locale"));

  const post = await prisma.post.findFirst({
    where: editor ? { id } : { id, status: "PUBLISHED" },
    include: postInclude,
  });

  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const items = await buildArticleMediaManifest(
    {
      id: post.id,
      coverImageUrl: post.coverImageUrl,
      bodyFr: post.bodyFr,
      bodyEn: post.bodyEn,
      mediaLinks: post.mediaLinks,
    },
    locale
  );

  return NextResponse.json(serializeMediaManifestResponse(items));
}
