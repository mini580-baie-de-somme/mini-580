import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { postInclude, withLegacyImages } from "@/lib/posts";
import { PostEditor } from "@/components/PostEditor";
import { getSyncEnv, isSyncConfigured, peerFetch } from "@/lib/sync-crypto";
import type { SyncPostSummary } from "@/lib/sync";

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

  let onProd: boolean | undefined;
  const isTestEnv = getSyncEnv() === "test";
  if (isTestEnv && isSyncConfigured()) {
    try {
      const res = await peerFetch("/api/sync/peer/export?resource=summaries", "export");
      if (res.ok) {
        const peer = (await res.json()) as SyncPostSummary[];
        onProd = peer.some((p) => p.id === post.id);
      }
    } catch {
      // Peer unreachable
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <PostEditor
        post={withLegacyImages(post)}
        tags={tags}
        themes={themes}
        milestones={milestones}
        isTestEnv={isTestEnv}
        onProd={onProd}
      />
    </div>
  );
}
