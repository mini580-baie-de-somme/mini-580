import Link from "next/link";
import { PostStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export const metadata = {
  title: "Timeline",
};

export default async function TimelinePage() {
  const milestones = await prisma.milestone.findMany({
    orderBy: [{ milestoneDate: "asc" }, { sortOrder: "asc" }],
    include: {
      posts: {
        include: {
          post: {
            select: {
              id: true,
              slug: true,
              titleFr: true,
              titleEn: true,
              status: true,
              publishedAt: true,
            },
          },
        },
      },
    },
  });

  const standalonePosts = await prisma.post.findMany({
    where: {
      status: PostStatus.PUBLISHED,
      milestones: { none: {} },
    },
    orderBy: { publishedAt: "asc" },
    select: {
      id: true,
      slug: true,
      titleFr: true,
      publishedAt: true,
    },
  });

  type TimelineEntry = {
    date: Date;
    kind: "milestone" | "post";
    milestone?: (typeof milestones)[0];
    post?: (typeof standalonePosts)[0];
  };

  const entries: TimelineEntry[] = [
    ...milestones.map((m) => ({
      date: m.milestoneDate,
      kind: "milestone" as const,
      milestone: m,
    })),
    ...standalonePosts
      .filter((p) => p.publishedAt)
      .map((p) => ({
        date: p.publishedAt!,
        kind: "post" as const,
        post: p,
      })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-[#0D131A]">Timeline du chantier</h1>
      <p className="mt-2 text-[#495867]">
        Jalons de construction Class Globe et articles du blog, ordonnés chronologiquement.
      </p>

      <div className="relative mt-12">
        <div className="absolute left-4 top-0 h-full w-px bg-[#d4dde6] sm:left-6" />

        <ul className="space-y-10">
          {entries.map((entry) => {
            const dateStr = entry.date.toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            });

            if (entry.kind === "milestone" && entry.milestone) {
              const m = entry.milestone;
              const linkedPosts = m.posts
                .map((pm) => pm.post)
                .filter((p) => p.status === PostStatus.PUBLISHED);

              return (
                <li key={`m-${m.id}`} className="relative pl-12 sm:pl-16">
                  <span className="absolute left-2.5 top-1.5 h-3 w-3 rounded-full border-2 border-[#495867] bg-white sm:left-[1.125rem]" />
                  <time className="text-xs font-medium uppercase tracking-wide text-[#495867]">
                    {dateStr}
                  </time>
                  <h2 className="mt-1 text-lg font-semibold text-[#0D131A]">{m.titleFr}</h2>
                  {m.descriptionFr && (
                    <p className="mt-2 text-sm text-[#495867]">{m.descriptionFr}</p>
                  )}
                  {linkedPosts.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {linkedPosts.map((p) => (
                        <li key={p.id}>
                          <Link
                            href={`/blog/${p.slug}`}
                            className="text-sm text-[#495867] hover:underline"
                          >
                            📄 {p.titleFr}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            }

            if (entry.kind === "post" && entry.post) {
              const p = entry.post;
              return (
                <li key={`p-${p.id}`} className="relative pl-12 sm:pl-16">
                  <span className="absolute left-2.5 top-1.5 h-3 w-3 rounded-full bg-[#495867] sm:left-[1.125rem]" />
                  <time className="text-xs font-medium uppercase tracking-wide text-[#495867]">
                    {dateStr}
                  </time>
                  <Link
                    href={`/blog/${p.slug}`}
                    className="mt-1 block text-lg font-medium text-[#0D131A] hover:text-[#495867]"
                  >
                    {p.titleFr}
                  </Link>
                </li>
              );
            }

            return null;
          })}
        </ul>

        {entries.length === 0 && (
          <p className="text-center text-[#495867]">Aucun jalon pour le moment.</p>
        )}
      </div>
    </div>
  );
}
