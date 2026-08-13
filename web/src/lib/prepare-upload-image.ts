/** Client-side downscale before multipart upload — mobile browsers often abort large uploads. */

/** Max edge for stored origin — rebake reads this file, so keep resolution high. */
export const ORIGIN_UPLOAD_MAX_DIMENSION = 4096;
const JPEG_QUALITY = 0.92;
/** Skip re-encode when already small enough (non-HEIC). */
const SKIP_BELOW_BYTES = 2 * 1024 * 1024;

function outputName(original: string): string {
  const base = original.replace(/\.[^.]+$/, "") || "photo";
  return `${base}.jpg`;
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode failed"));
    };
    img.src = url;
  });
}

function canvasToJpegBlob(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("encode failed"));
      },
      "image/jpeg",
      quality
    );
  });
}

/**
 * Downscale / re-encode photos before upload. Returns the original file when
 * compression is unnecessary or unsupported (PDF, video, tiny JPEG, etc.).
 */
export async function prepareImageForUpload(file: File): Promise<File> {
  if (typeof window === "undefined") return file;
  if (!file.type.startsWith("image/")) return file;

  const isHeic =
    /heic|heif/i.test(file.type) || /\.heic$|\.heif$/i.test(file.name);
  if (!isHeic && file.size <= SKIP_BELOW_BYTES) return file;

  try {
    const img = await loadImageFromFile(file);
    const { naturalWidth: w, naturalHeight: h } = img;
    if (!w || !h) return file;

    const maxEdge = Math.max(w, h);
    if (!isHeic && maxEdge <= ORIGIN_UPLOAD_MAX_DIMENSION) return file;

    const scale = Math.min(1, ORIGIN_UPLOAD_MAX_DIMENSION / maxEdge);
    const tw = Math.max(1, Math.round(w * scale));
    const th = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, tw, th);

    const blob = await canvasToJpegBlob(canvas, JPEG_QUALITY);
    if (blob.size >= file.size && !isHeic) return file;

    return new File([blob], outputName(file.name), {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}
