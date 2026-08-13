import { NextRequest, NextResponse } from "next/server";
import { resolveSlugRedirect, type SlugEntity } from "@/lib/slug-history";

type RouteContext = { params: Promise<{ entity: string; slug: string }> };

const ENTITIES = new Set<SlugEntity>(["post", "media", "media-group"]);

function parseEntity(value: string): SlugEntity | null {
  if (ENTITIES.has(value as SlugEntity)) return value as SlugEntity;
  if (value === "media_group") return "media-group";
  return null;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { entity: entityParam, slug } = await context.params;
  const entity = parseEntity(entityParam);
  if (!entity) {
    return NextResponse.json({ error: "Invalid entity" }, { status: 400 });
  }

  const resolution = await resolveSlugRedirect(entity, decodeURIComponent(slug));
  if (!resolution) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(resolution);
}
