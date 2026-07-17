"use client";

import type { MediaKindClient } from "@/lib/media-file-client";

type Props = {
  kind: MediaKindClient;
  src: string;
  title?: string;
  openLabel: string;
  className?: string;
};

export function MediaPreview({
  kind,
  src,
  title,
  openLabel,
  className = "",
}: Props) {
  if (kind === "IMAGE") {
    return (
      <div
        className={`overflow-hidden rounded-lg border border-[#d4dde6] bg-[#fafbfc] ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={title || ""}
          className="mx-auto max-h-72 w-auto object-contain"
        />
      </div>
    );
  }

  if (kind === "VIDEO") {
    return (
      <div
        className={`overflow-hidden rounded-lg border border-[#d4dde6] bg-[#0D131A] ${className}`}
      >
        <video
          src={src}
          controls
          className="mx-auto max-h-72 w-full"
          preload="metadata"
        />
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border border-[#d4dde6] bg-white p-3 ${className}`}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-[#0D131A]">
          {title || "PDF"}
        </span>
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="rounded-md bg-[#495867] px-3 py-1 text-xs text-white hover:bg-[#3a4654]"
        >
          {openLabel}
        </a>
      </div>
      <iframe
        title={title || "pdf"}
        src={src}
        className="h-64 w-full rounded border border-[#d4dde6]"
      />
    </div>
  );
}
