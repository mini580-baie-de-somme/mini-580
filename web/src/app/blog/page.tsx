import { prisma } from "@/lib/db";
import { publicPostWhere, postInclude } from "@/lib/posts";
import { BlogPageContent } from "@/components/BlogPageContent";

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
    <BlogPageContent
      posts={posts}
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
      }}
    />
  );
}
