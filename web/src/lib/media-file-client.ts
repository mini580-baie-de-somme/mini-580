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
