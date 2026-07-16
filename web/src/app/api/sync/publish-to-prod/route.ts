import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PostStatus } from "@/generated/prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSyncEnv, isSyncConfigured, peerFetch } from "@/lib/sync-crypto";
import { exportPostById } from "@/lib/sync";

const bodySchema = z.object({
  postId: z.string().min(1),
  publish: z.boolean().optional().default(true),
});

/**
 * Publish a TEST-only (or local) post to PROD via peer import.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSyncConfigured()) {
    return NextResponse.json({ error: "Sync not configured" }, { status: 503 });
  }
  if (getSyncEnv() !== "test") {
    return NextResponse.json(
      { error: "Publish to PROD is only available on TEST" },
      { status: 400 }
    );
  }

  try {
    const { postId, publish } = bodySchema.parse(await request.json());
    let payload = await exportPostById(postId);
    if (!payload) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (publish && payload.status !== PostStatus.PUBLISHED) {
      await prisma.post.update({
        where: { id: postId },
        data: {
          status: PostStatus.PUBLISHED,
          publishedAt: new Date(),
        },
      });
      payload = (await exportPostById(postId))!;
    }

    const res = await peerFetch("/api/sync/peer/import", "import", {
      method: "PUT",
      body: JSON.stringify({ type: "post", payload }),
    });
    if (!res.ok) {
      throw new Error(`Peer import failed: ${await res.text()}`);
    }

    return NextResponse.json({ ok: true, id: postId, status: payload.status });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Publish failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
