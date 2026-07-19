/** Client-safe MIME / kind helpers (mirror of media-bucket rules, no Node imports). */

export type MediaKindClient = "IMAGE" | "DOCUMENT" | "VIDEO";

const ALLOWED = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "video/mp4",
  "video/webm",
]);

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  mp4: "video/mp4",
  webm: "video/webm",
};

export const MEDIA_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,application/pdf,video/mp4,video/webm";

export function normalizeMime(mime: string): string {
  const raw = mime.toLowerCase().split(";")[0].trim();
  if (raw === "image/jpg") return "image/jpeg";
  return raw;
}

export function mimeFromFilename(filename: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_MIME[ext] ?? null;
}

export function resolveFileMime(file: File): string | null {
  const fromType = file.type ? normalizeMime(file.type) : "";
  if (fromType && ALLOWED.has(fromType)) {
    return fromType === "image/jpg" ? "image/jpeg" : fromType;
  }
  return mimeFromFilename(file.name);
}

export function isAllowedMediaFile(file: File): boolean {
  const mime = resolveFileMime(file);
  return mime !== null && ALLOWED.has(mime);
}

export function kindFromMime(mime: string): MediaKindClient | null {
  const ct = normalizeMime(mime);
  if (ct.startsWith("image/")) return "IMAGE";
  if (ct === "application/pdf") return "DOCUMENT";
  if (ct.startsWith("video/")) return "VIDEO";
  return null;
}

export function kindFromFile(file: File): MediaKindClient | null {
  const mime = resolveFileMime(file);
  return mime ? kindFromMime(mime) : null;
}

function looksLikePdfUrl(src: string | null | undefined): boolean {
  if (!src) return false;
  const path = src.split("?")[0].toLowerCase();
  return path.endsWith(".pdf");
}

function looksLikeVideoUrl(src: string | null | undefined): boolean {
  if (!src) return false;
  const path = src.split("?")[0].toLowerCase();
  return path.endsWith(".mp4") || path.endsWith(".webm");
}

/** Prefer mimeType, then kind, then URL extension — never treat PDF/video as image. */
export function resolveThumbKind(
  kind?: string | null,
  mimeType?: string | null,
  src?: string | null
): MediaKindClient {
  const fromMime = mimeType ? kindFromMime(mimeType) : null;
  if (fromMime) return fromMime;
  if (kind === "DOCUMENT" || kind === "VIDEO" || kind === "IMAGE") return kind;
  if (looksLikePdfUrl(src)) return "DOCUMENT";
  if (looksLikeVideoUrl(src)) return "VIDEO";
  return "IMAGE";
}

export type ClipboardPasteError =
  | "unsupported"
  | "empty"
  | "permission"
  | "not_image";

export type ClipboardPasteResult =
  | { ok: true; file: File }
  | { ok: false; error: ClipboardPasteError };

function extensionForImageMime(mime: string): string {
  const normalized = normalizeMime(mime);
  if (normalized === "image/jpeg") return "jpg";
  if (normalized === "image/png") return "png";
  if (normalized === "image/webp") return "webp";
  if (normalized === "image/gif") return "gif";
  return "png";
}

/**
 * Read an image blob from the system clipboard (user gesture required).
 * Ignores text/URL clipboard entries — images only.
 */
export async function pasteImageFromClipboard(): Promise<ClipboardPasteResult> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.read) {
    return { ok: false, error: "unsupported" };
  }

  try {
    const items = await navigator.clipboard.read();
    let sawNonImage = false;

    for (const item of items) {
      const imageType = item.types.find((type) => type.startsWith("image/"));
      if (!imageType) {
        if (
          item.types.some(
            (type) =>
              type === "text/plain" ||
              type === "text/uri-list" ||
              type === "text/html"
          )
        ) {
          sawNonImage = true;
        }
        continue;
      }

      const blob = await item.getType(imageType);
      const mime = normalizeMime(imageType);
      const file = new File(
        [blob],
        `clipboard-${Date.now()}.${extensionForImageMime(mime)}`,
        { type: mime }
      );
      if (isAllowedMediaFile(file) && kindFromFile(file) === "IMAGE") {
        return { ok: true, file };
      }
    }

    if (sawNonImage) return { ok: false, error: "not_image" };
    return { ok: false, error: "empty" };
  } catch (err) {
    if (err instanceof DOMException && err.name === "NotAllowedError") {
      return { ok: false, error: "permission" };
    }
    return { ok: false, error: "empty" };
  }
}

/** Prefer image, then pdf, then video from clipboard / dataTransfer. */
export function mediaFileFromDataTransfer(data: DataTransfer | null): File | null {
  if (!data) return null;
  for (const item of data.items) {
    if (
      item.type.startsWith("image/") ||
      item.type === "application/pdf" ||
      item.type.startsWith("video/")
    ) {
      const file = item.getAsFile();
      if (file && isAllowedMediaFile(file)) return file;
    }
  }
  for (const file of data.files) {
    if (isAllowedMediaFile(file)) return file;
  }
  return null;
}
