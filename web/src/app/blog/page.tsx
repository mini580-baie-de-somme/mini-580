import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { publicPostWhere, postInclude } from "@/lib/posts";
import { PostCard } from "@/components/PostCard";
import { BlogFilters } from "@/components/BlogFilters";

type SearchParams = Promise<{
  hull?: string;
  theme?: string;
  tag?: string;
  search?: string;
}>;

export const metadata = {
  title: "Blog",
};

export default async function BlogPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const [posts, themes, tags] = await Promise.all([
    prisma.post.findMany({
      where: publicPostWhere(params),
      include: postInclude,
      orderBy: { publishedAt: "desc" },
    }),
    prisma.theme.findMany({ orderBy: { slug: "asc" } }),
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="blog-gradient min-h-full">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold text-[#0D131A]">Blog de construction</h1>
        <p className="mt-2 text-[#495867]">
          Articles anti-chronologiques — filtres par coque, thème ou mot-clé.
        </p>

        <div className="mt-8">
          <Suspense fallback={<div className="h-24 animate-pulse rounded-lg bg-white/50" />}>
            <BlogFilters
              options={{
                themes: themes.map((t) => ({ slug: t.slug, labelFr: t.labelFr })),
                tags: tags.map((t) => ({ name: t.name, labelFr: t.labelFr })),
              }}
            />
          </Suspense>
        </div>

        {posts.length === 0 ? (
          <p className="mt-12 text-center text-[#495867]">Aucun article publié.</p>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
