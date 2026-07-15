import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { postInclude } from "@/lib/posts";
import { PostEditor } from "@/components/PostEditor";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditPostPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/connexion");

  const { id } = await params;
  const [post, tags, themes, milestones] = await Promise.all([
    prisma.post.findUnique({ where: { id }, include: postInclude }),
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
    prisma.theme.findMany({ orderBy: { slug: "asc" } }),
    prisma.milestone.findMany({ orderBy: { milestoneDate: "asc" } }),
  ]);

  if (!post) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <PostEditor post={post} tags={tags} themes={themes} milestones={milestones} />
    </div>
  );
}
