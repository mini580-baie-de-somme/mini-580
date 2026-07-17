import { NextRequest, NextResponse } from "next/server";
import { listGalleryPhotos, type GalleryFilters } from "@/lib/gallery";

/**
 * Public gallery feed — usable by the blog UI and as an AI tool (no auth).
 * Query: hull, theme, tag, milestone, search, sort=date|milestone
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const filters: GalleryFilters = {
    hull: sp.get("hull") ?? undefined,
    theme: sp.get("theme") ?? undefined,
    tag: sp.get("tag") ?? undefined,
    milestone: sp.get("milestone") ?? undefined,
    search: sp.get("search") ?? undefined,
    kind: (sp.get("kind") as GalleryFilters["kind"]) ?? undefined,
    sort: sp.get("sort") === "milestone" ? "milestone" : "date",
  };

  const photos = await listGalleryPhotos(filters);
  return NextResponse.json({
    count: photos.length,
    sort: filters.sort ?? "date",
    photos,
    items: photos,
  });
}
