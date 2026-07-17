"use client";

import { resolveThumbKind } from "@/lib/media-file-client";

type MediaKindThumbProps = {
  kind?: "IMAGE" | "DOCUMENT" | "VIDEO" | string | null;
  mimeType?: string | null;
  /** IMAGE only — preferred thumb URL */
  src?: string | null;
  className?: string;
  size?: "sm" | "md";
};

function PdfIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h1.2a1.4 1.4 0 0 1 0 2.8H8V18" />
      <path d="M12.2 13H13a1.5 1.5 0 0 1 0 3h-.8" />
      <path d="M12.2 16.5V13" />
      <path d="M16 18v-5h1.6" />
    </svg>
  );
}

function VideoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="M16 10.5l5-3v9l-5-3v-3z" />
    </svg>
  );
}

export function MediaKindThumb({
  kind,
  mimeType,
  src,
  className = "",
  size = "sm",
}: MediaKindThumbProps) {
  const box = size === "md" ? "h-16 w-16" : "h-10 w-10";
  const icon = size === "md" ? "h-8 w-8" : "h-5 w-5";
  const resolved = resolveThumbKind(kind, mimeType, src);
  const path = (src ?? "").split("?")[0].toLowerCase();
  const srcLooksLikeNonImage =
    path.endsWith(".pdf") || path.endsWith(".mp4") || path.endsWith(".webm");

  if (resolved === "DOCUMENT") {
    return (
      <span
        className={`flex ${box} items-center justify-center rounded bg-[#eef3f7] text-[#495867] ${className}`}
        title="PDF"
        aria-label="PDF"
      >
        <PdfIcon className={icon} />
      </span>
    );
  }

  if (resolved === "VIDEO") {
    return (
      <span
        className={`flex ${box} items-center justify-center rounded bg-[#eef3f7] text-[#495867] ${className}`}
        title="Video"
        aria-label="Video"
      >
        <VideoIcon className={icon} />
      </span>
    );
  }

  if (src && !srcLooksLikeNonImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className={`${box} rounded object-cover ${className}`}
      />
    );
  }

  return (
    <span
      className={`flex ${box} items-center justify-center rounded bg-[#eef3f7] text-[10px] font-semibold text-[#495867] ${className}`}
    >
      ?
    </span>
  );
}
