import { createHash, randomUUID } from "node:crypto";
import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import type { Readable } from "node:stream";

/** S3-inspired object storage contract (no third-party SDK). */
export type MediaObjectMeta = {
  key: string;
  contentType: string;
  contentLength: number;
  etag: string;
};

export type MediaPutResult = MediaObjectMeta & {
  url: string;
};

export type MediaGetResult = MediaObjectMeta & {
  body: Buffer;
};

export interface MediaBucket {
  putObject(
    key: string,
    body: Buffer,
    contentType: string
  ): Promise<MediaPutResult>;
  getObject(key: string): Promise<MediaGetResult | null>;
  headObject(key: string): Promise<MediaObjectMeta | null>;
  deleteObject(key: string): Promise<void>;
  createReadStream(key: string): Promise<Readable | null>;
  publicUrl(key: string): string;
  createObjectKey(filename: string): string;
}

const ALLOWED_CONTENT_TYPES = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/jpg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

const EXT_TO_CONTENT_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

/** Max object size (bytes). nginx client_max_body_size is 20M. */
export const MEDIA_MAX_BYTES = 10 * 1024 * 1024;

const KEY_RE = /^[a-zA-Z0-9][a-zA-Z0-9/_ .-]*\.(jpe?g|png|webp|gif)$/i;

export function isAllowedContentType(contentType: string): boolean {
  return ALLOWED_CONTENT_TYPES.has(contentType.toLowerCase().split(";")[0].trim());
}

export function normalizeContentType(contentType: string): string {
  const raw = contentType.toLowerCase().split(";")[0].trim();
  if (raw === "image/jpg") return "image/jpeg";
  return raw;
}

export function extensionForContentType(contentType: string): string | null {
  return ALLOWED_CONTENT_TYPES.get(normalizeContentType(contentType)) ?? null;
}

export function contentTypeFromFilename(filename: string): string | null {
  const ext = path.extname(filename).replace(".", "").toLowerCase();
  return EXT_TO_CONTENT_TYPE[ext] ?? null;
}

export function assertSafeMediaKey(key: string): string {
  const normalized = key.replace(/^\/+/, "").replace(/\\/g, "/");
  if (
    !normalized ||
    normalized.includes("..") ||
    normalized.startsWith("/") ||
    !KEY_RE.test(normalized)
  ) {
    throw new MediaBucketError("Invalid object key", 400);
  }
  return normalized;
}

export class MediaBucketError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "MediaBucketError";
  }
}

function etagOf(body: Buffer): string {
  return `"${createHash("md5").update(body).digest("hex")}"`;
}

/**
 * Local disk bucket — S3-like put/get/head/delete on a host-persisted directory.
 * Survives container redeploys when MEDIA_ROOT is a Docker bind mount.
 */
export class LocalDiskBucket implements MediaBucket {
  constructor(
    private readonly root: string,
    private readonly publicBase = "/media"
  ) {}

  createObjectKey(filename: string): string {
    const fromName = contentTypeFromFilename(filename);
    let ext = fromName
      ? extensionForContentType(fromName) ?? ""
      : path.extname(filename).replace(".", "").toLowerCase();
    if (ext === "jpeg") ext = "jpg";
    if (!["jpg", "png", "webp", "gif"].includes(ext)) {
      throw new MediaBucketError("Unsupported file extension", 400);
    }
    const now = new Date();
    const yyyy = String(now.getUTCFullYear());
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    return `${yyyy}/${mm}/${randomUUID()}.${ext}`;
  }

  publicUrl(key: string): string {
    const safe = assertSafeMediaKey(key);
    const base = this.publicBase.replace(/\/+$/, "");
    return `${base}/${safe}`;
  }

  private resolvePath(key: string): string {
    const safe = assertSafeMediaKey(key);
    const full = path.resolve(this.root, safe);
    const rootResolved = path.resolve(this.root);
    if (full !== rootResolved && !full.startsWith(rootResolved + path.sep)) {
      throw new MediaBucketError("Invalid object key", 400);
    }
    return full;
  }

  async putObject(
    key: string,
    body: Buffer,
    contentType: string
  ): Promise<MediaPutResult> {
    if (body.byteLength === 0) {
      throw new MediaBucketError("Empty object body", 400);
    }
    if (body.byteLength > MEDIA_MAX_BYTES) {
      throw new MediaBucketError(
        `Object exceeds ${MEDIA_MAX_BYTES} bytes`,
        413
      );
    }
    const ct = normalizeContentType(contentType);
    if (!isAllowedContentType(ct)) {
      throw new MediaBucketError("Unsupported Content-Type", 415);
    }

    const full = this.resolvePath(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, body);
    // Sidecar for content-type (no DB table required)
    await fs.writeFile(`${full}.meta.json`, JSON.stringify({ contentType: ct }));

    const etag = etagOf(body);
    return {
      key: assertSafeMediaKey(key),
      contentType: ct,
      contentLength: body.byteLength,
      etag,
      url: this.publicUrl(key),
    };
  }

  private async readMeta(full: string): Promise<string | null> {
    try {
      const raw = await fs.readFile(`${full}.meta.json`, "utf8");
      const parsed = JSON.parse(raw) as { contentType?: string };
      return parsed.contentType ? normalizeContentType(parsed.contentType) : null;
    } catch {
      return null;
    }
  }

  private guessContentType(key: string): string {
    return contentTypeFromFilename(key) ?? "application/octet-stream";
  }

  async headObject(key: string): Promise<MediaObjectMeta | null> {
    const full = this.resolvePath(key);
    try {
      const stat = await fs.stat(full);
      if (!stat.isFile()) return null;
      const body = await fs.readFile(full);
      const contentType =
        (await this.readMeta(full)) ?? this.guessContentType(key);
      return {
        key: assertSafeMediaKey(key),
        contentType,
        contentLength: stat.size,
        etag: etagOf(body),
      };
    } catch {
      return null;
    }
  }

  async getObject(key: string): Promise<MediaGetResult | null> {
    const full = this.resolvePath(key);
    try {
      const body = await fs.readFile(full);
      const contentType =
        (await this.readMeta(full)) ?? this.guessContentType(key);
      return {
        key: assertSafeMediaKey(key),
        body,
        contentType,
        contentLength: body.byteLength,
        etag: etagOf(body),
      };
    } catch {
      return null;
    }
  }

  async createReadStream(key: string): Promise<Readable | null> {
    const full = this.resolvePath(key);
    try {
      await fs.access(full);
      return createReadStream(full);
    } catch {
      return null;
    }
  }

  async deleteObject(key: string): Promise<void> {
    const full = this.resolvePath(key);
    try {
      await fs.unlink(full);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") throw err;
    }
    try {
      await fs.unlink(`${full}.meta.json`);
    } catch {
      // ignore missing sidecar
    }
  }
}

let cached: LocalDiskBucket | null = null;

export function getMediaRoot(): string {
  if (process.env.MEDIA_ROOT?.trim()) {
    return path.resolve(process.env.MEDIA_ROOT.trim());
  }
  // Local/dev default: web/data/media (gitignored, outside Docker layers)
  return path.resolve(process.cwd(), "data", "media");
}

export function getMediaPublicBase(): string {
  return (process.env.MEDIA_PUBLIC_BASE?.trim() || "/media").replace(/\/+$/, "");
}

export function getMediaBucket(): LocalDiskBucket {
  if (!cached) {
    cached = new LocalDiskBucket(getMediaRoot(), getMediaPublicBase());
  }
  return cached;
}

/** Extract object key from a stored public URL or raw key. */
export function mediaKeyFromUrl(url: string): string | null {
  try {
    const base = getMediaPublicBase();
    let pathname = url;
    if (url.startsWith("http://") || url.startsWith("https://")) {
      pathname = new URL(url).pathname;
    }
    if (!pathname.startsWith(base + "/") && pathname !== base) {
      return null;
    }
    const key = pathname.slice(base.length).replace(/^\/+/, "");
    return assertSafeMediaKey(key);
  } catch {
    return null;
  }
}
