import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { listGalleryPhotos } from "@/lib/gallery";
import { GalleryPageContent } from "@/components/GalleryPageContent";

type SearchParams = Promise<{
  hull?: string;
  theme?: string;
  tag?: string;
  milestone?: string;
  search?: string;
  sort?: string;
  kind?: string;
}>;

export const metadata = {
  title: "Galerie",
};

export default async function GaleriePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const kind =
    params.kind === "IMAGE" ||
    params.kind === "DOCUMENT" ||
    params.kind === "VIDEO"
      ? params.kind
      : undefined;
  const [photos, themes, tags, milestones] = await Promise.all([
    listGalleryPhotos({
      hull: params.hull,
      theme: params.theme,
      tag: params.tag,
      milestone: params.milestone,
      search: params.search,
      kind,
      sort: params.sort === "milestone" ? "milestone" : "date",
    }),
    prisma.theme.findMany({ orderBy: { slug: "asc" } }),
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
    prisma.milestone.findMany({ orderBy: { milestoneDate: "asc" } }),
  ]);

  return (
    <Suspense fallback={<div className="p-12 text-center text-[#495867]">…</div>}>
      <GalleryPageContent
        photos={photos}
        options={{
          themes: themes.map((t) => ({
            slug: t.slug,
            labelFr: t.labelFr,
            labelEn: t.labelEn,
          })),
          tags: tags.map((t) => ({
            name: t.name,
            labelFr: t.labelFr,
            labelEn: t.labelEn,
          })),
          milestones: milestones.map((m) => ({
            slug: m.slug,
            titleFr: m.titleFr,
            titleEn: m.titleEn,
          })),
        }}
      />
    </Suspense>
  );
}
