/** Shared upload size limits (keep nginx client_max_body_size ≥ VIDEO max). */

export const MEDIA_MAX_BYTES = 10 * 1024 * 1024;
export const MEDIA_VIDEO_MAX_BYTES = 100 * 1024 * 1024;

export function maxBytesForMime(mime: string): number {
  const ct = mime.toLowerCase().split(";")[0].trim();
  return ct.startsWith("video/") ? MEDIA_VIDEO_MAX_BYTES : MEDIA_MAX_BYTES;
}

export function formatMaxMb(bytes: number): number {
  return Math.round(bytes / (1024 * 1024));
}
