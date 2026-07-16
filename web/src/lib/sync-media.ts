import "server-only";

import { createHash } from "node:crypto";
import {
  assertSafeMediaKey,
  getMediaBucket,
  mediaKeyFromUrl,
} from "@/lib/media-bucket";
import { peerFetch } from "@/lib/sync-crypto";

export function sha256Hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

/** Collect unique media object keys from a post payload (cover + image variants). */
export function collectMediaKeysFromPost(post: {
  coverImageUrl?: string | null;
  images?: {
    urlOrigin?: string;
    urlPicto?: string | null;
    urlPetite?: string | null;
    urlMoyenne?: string | null;
    urlGrande?: string | null;
    url?: string;
  }[];
}): string[] {
  const keys = new Set<string>();
  const add = (url: string | null | undefined) => {
    if (!url) return;
    try {
      let pathname = url;
      if (url.startsWith("http://") || url.startsWith("https://")) {
        pathname = new URL(url).pathname;
      }
      const key = mediaKeyFromUrl(pathname) ?? mediaKeyFromUrl(url);
      if (key) keys.add(key);
    } catch {
      // ignore bad URLs
    }
  };

  add(post.coverImageUrl);
  for (const img of post.images ?? []) {
    add(img.urlOrigin ?? img.url);
    add(img.urlPicto);
    add(img.urlPetite);
    add(img.urlMoyenne);
    add(img.urlGrande);
  }
  return [...keys];
}

/**
 * Pull one media object from peer → local bucket (HTTPS GET + checksum check).
 */
export async function pullMediaFromPeer(key: string): Promise<{
  key: string;
  url: string;
  checksum: string;
}> {
  const safe = assertSafeMediaKey(key);
  const res = await peerFetch(
    `/api/sync/peer/media?key=${encodeURIComponent(safe)}`,
    "media_export"
  );
  if (!res.ok) {
    throw new Error(`Media export failed (${safe}): ${await res.text()}`);
  }

  const expected =
    res.headers.get("x-content-sha256")?.trim().toLowerCase() ?? "";
  const contentType =
    res.headers.get("content-type")?.split(";")[0].trim() ||
    "application/octet-stream";
  const body = Buffer.from(await res.arrayBuffer());
  const actual = sha256Hex(body);
  if (expected && expected !== actual) {
    throw new Error(
      `Media checksum mismatch for ${safe}: expected ${expected}, got ${actual}`
    );
  }

  const stored = await getMediaBucket().putObject(safe, body, contentType);
  return { key: safe, url: stored.url, checksum: actual };
}

/**
 * Push one local media object to peer (HTTPS POST multipart + mime + checksum).
 */
export async function pushMediaToPeer(key: string): Promise<{
  key: string;
  url: string;
  checksum: string;
}> {
  const safe = assertSafeMediaKey(key);
  const obj = await getMediaBucket().getObject(safe);
  if (!obj) {
    throw new Error(`Local media missing: ${safe}`);
  }

  const checksum = sha256Hex(obj.body);
  const form = new FormData();
  form.append("key", safe);
  form.append("checksum", checksum);
  form.append("contentType", obj.contentType);
  form.append(
    "file",
    new Blob([new Uint8Array(obj.body)], { type: obj.contentType }),
    safe.split("/").pop() || "file"
  );

  const res = await peerFetch("/api/sync/peer/media", "media_import", {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Media import failed (${safe}): ${await res.text()}`);
  }
  const data = (await res.json()) as {
    key: string;
    url: string;
    checksum: string;
  };
  return data;
}

/** Pull many keys; skip missing on peer (404). */
export async function pullMediaKeysFromPeer(
  keys: string[],
  onProgress?: (done: number, total: number, key: string) => void
): Promise<{ synced: string[]; skipped: string[]; failed: string[] }> {
  const synced: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];
  const unique = [...new Set(keys)];

  for (let i = 0; i < unique.length; i++) {
    const key = unique[i];
    onProgress?.(i, unique.length, key);
    try {
      const local = await getMediaBucket().headObject(key);
      if (local) {
        skipped.push(key);
        continue;
      }
      await pullMediaFromPeer(key);
      synced.push(key);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("404") || msg.includes("Not found")) {
        skipped.push(key);
      } else {
        failed.push(key);
      }
    }
  }
  onProgress?.(unique.length, unique.length, "");
  return { synced, skipped, failed };
}

/** Push many keys to peer. */
export async function pushMediaKeysToPeer(
  keys: string[],
  onProgress?: (done: number, total: number, key: string) => void
): Promise<{ synced: string[]; failed: string[] }> {
  const synced: string[] = [];
  const failed: string[] = [];
  const unique = [...new Set(keys)];

  for (let i = 0; i < unique.length; i++) {
    const key = unique[i];
    onProgress?.(i, unique.length, key);
    try {
      await pushMediaToPeer(key);
      synced.push(key);
    } catch {
      failed.push(key);
    }
  }
  onProgress?.(unique.length, unique.length, "");
  return { synced, failed };
}
