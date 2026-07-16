import { createHash, generateKeyPairSync, randomBytes } from "node:crypto";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { NextRequest } from "next/server";
import sharp from "sharp";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/constants";
import { createSessionToken } from "@/lib/auth";

export const INGEST_KEY =
  process.env.INGEST_API_KEY || "integration-test-ingest-key-32chars";

export const ADMIN_EMAIL =
  process.env.SEED_ADMIN_EMAIL || "admin@classmini580.blog";

export function bearerHeaders(extra?: HeadersInit): HeadersInit {
  return {
    Authorization: `Bearer ${INGEST_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export function jsonRequest(
  url: string,
  init?: RequestInit & { searchParams?: Record<string, string> }
): NextRequest {
  const u = new URL(url, "http://localhost:3002");
  if (init?.searchParams) {
    for (const [k, v] of Object.entries(init.searchParams)) {
      u.searchParams.set(k, v);
    }
  }
  const { searchParams: _sp, ...rest } = init ?? {};
  return new NextRequest(u, rest);
}

export async function ensureAdminUser() {
  const passwordHash = await hashPassword(
    process.env.SEED_ADMIN_PASSWORD || "changeme123"
  );
  return prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      email: ADMIN_EMAIL,
      name: "Admin IT",
      passwordHash,
    },
  });
}

export async function sessionCookieHeader(user: {
  id: string;
  email: string;
  name: string | null;
}): Promise<string> {
  const token = await createSessionToken(user);
  return `${SESSION_COOKIE}=${token}`;
}

/** Minimal 64×64 JPEG for multipart uploads */
export async function makeTestJpeg(): Promise<Buffer> {
  return sharp({
    create: {
      width: 64,
      height: 64,
      channels: 3,
      background: { r: 20, g: 120, b: 200 },
    },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
}

export function uniqueSlug(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
}

export async function resetMediaRoot() {
  const root = process.env.MEDIA_ROOT || resolve(process.cwd(), "data/media-it");
  if (existsSync(root)) {
    rmSync(root, { recursive: true, force: true });
  }
  mkdirSync(root, { recursive: true });
}

export function generateSyncKeyPair(): { privateKey: string; publicKey: string } {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  return { privateKey, publicKey };
}

export function fingerprint(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex").slice(0, 12);
}

export async function cleanupTestPosts(slugPrefix: string) {
  const posts = await prisma.post.findMany({
    where: { slug: { startsWith: slugPrefix } },
    select: { id: true },
  });
  if (posts.length) {
    await prisma.post.deleteMany({
      where: { id: { in: posts.map((p) => p.id) } },
    });
  }
}

export async function cleanupBySlug(
  model: "tag" | "theme" | "milestone",
  prefix: string
) {
  if (model === "tag") {
    await prisma.tag.deleteMany({ where: { name: { startsWith: prefix } } });
  } else if (model === "theme") {
    await prisma.theme.deleteMany({ where: { slug: { startsWith: prefix } } });
  } else {
    await prisma.milestone.deleteMany({
      where: { slug: { startsWith: prefix } },
    });
  }
}
