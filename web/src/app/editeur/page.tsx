import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { postInclude } from "@/lib/posts";
import { EditorPostList } from "@/components/EditorPostList";
import { getSyncEnv, isSyncConfigured, peerFetch } from "@/lib/sync-crypto";
import type { SyncPostSummary } from "@/lib/sync";

export const metadata = {
  title: "Éditeur",
};

export default async function EditeurPage() {
  const session = await getSession();
  if (!session) redirect("/connexion");

  const posts = await prisma.post.findMany({
    include: postInclude,
    orderBy: { updatedAt: "desc" },
  });

  let prodIds = new Set<string>();
  const isTestEnv = getSyncEnv() === "test";
  if (isTestEnv && isSyncConfigured()) {
    try {
      const res = await peerFetch("/api/sync/peer/export?resource=summaries", "export");
      if (res.ok) {
        const peer = (await res.json()) as SyncPostSummary[];
        prodIds = new Set(peer.map((p) => p.id));
      }
    } catch {
      // Peer unreachable — hide publish hints
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <EditorPostList
        isTestEnv={isTestEnv}
        posts={posts.map((p) => ({
          id: p.id,
          slug: p.slug,
          titleFr: p.titleFr,
          status: p.status,
          updatedAt: p.updatedAt.toISOString(),
          hulls: p.hulls,
          onProd: prodIds.has(p.id),
        }))}
      />
    </div>
  );
}
