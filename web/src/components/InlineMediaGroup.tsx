"use client";

import type { ReactNode } from "react";
import { resolveThumbKind } from "@/lib/media-file-client";
import type { ArticleManifestMedia, PublicMediaGroup } from "@/lib/article-media-types";
import { MediaKindThumb } from "./MediaKindThumb";
type MosaicMedia = ArticleManifestMedia;

function thumbSrc(img: MosaicMedia): string {
  return (
    img.urlPetite ||
    img.urlPicto ||
    img.urlMoyenne ||
    img.urlOrigin ||
    ""
  );
}

function MosaicTile({
  media,
  locale,
  className = "",
  overlay,
}: {
  media: MosaicMedia;
  locale: "fr" | "en";
  className?: string;
  overlay?: ReactNode;
}) {
  const kind = resolveThumbKind(media.kind, media.mimeType, media.urlOrigin);
  const src = thumbSrc(media);
  const label =
    (locale === "fr" ? media.titleFr : media.titleEn) || "";

  return (
    <div
      className={`relative aspect-square overflow-hidden bg-[#eef3f7] ${className}`}
    >
      {kind === "IMAGE" && src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={label}
          className="h-full w-full object-cover object-center"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[#495867]">
          <MediaKindThumb
            kind={kind}
            mimeType={media.mimeType}
            src={null}
            size="sm"
            className="h-10 w-10 bg-transparent"
          />
          <span className="px-1 text-center text-[10px] uppercase tracking-wide">
            {kind === "DOCUMENT" ? "PDF" : kind === "VIDEO" ? "Video" : label}
          </span>
        </div>
      )}
      {overlay}
    </div>
  );
}

export function InlineMediaGroup({
  group,
  locale,
  onOpen,
}: {
  group: PublicMediaGroup | null;
  locale: "fr" | "en";
  manifestIndex?: number;
  onOpen: () => void;
}) {
  if (!group) {
    return (
      <div
        role="note"
        className="my-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
      >
        {locale === "fr"
          ? "Groupe de médias introuvable."
          : "Media group not found."}
      </div>
    );
  }

  const members = group.members;
  const count = members.length;
  const title = locale === "fr" ? group.titleFr : group.titleEn;
  const ariaLabel =
    locale === "fr"
      ? `Voir ${count} média${count > 1 ? "s" : ""}${title ? ` — ${title}` : ""}`
      : `View ${count} media item${count !== 1 ? "s" : ""}${title ? ` — ${title}` : ""}`;

  if (count === 0) {
    return (
      <div className="my-6 rounded-lg border border-dashed border-[#d4dde6] bg-[#f8fafc] px-4 py-6 text-center text-sm text-[#495867]">
        {locale === "fr" ? "Groupe vide." : "Empty group."}
      </div>
    );
  }

  const canOpen = count > 0;

  return (
    <figure className="my-6 w-full sm:my-8">
      <button
        type="button"
        onClick={canOpen ? onOpen : undefined}
        disabled={!canOpen}
        aria-label={ariaLabel}
        className="group w-full overflow-hidden rounded-xl border border-[#d4dde6] shadow-sm transition hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#495867] focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-100"
      >
        <div className="w-full overflow-hidden">
          {count === 1 && (
            <MosaicTile media={members[0]!} locale={locale} className="w-full" />
          )}

          {count === 2 && (
            <div className="grid grid-cols-2 gap-0.5">
              <MosaicTile media={members[0]!} locale={locale} />
              <MosaicTile media={members[1]!} locale={locale} />
            </div>
          )}

          {count === 3 && (
            <div className="grid grid-cols-3 gap-0.5">
              <MosaicTile media={members[0]!} locale={locale} />
              <MosaicTile media={members[1]!} locale={locale} />
              <MosaicTile media={members[2]!} locale={locale} />
            </div>
          )}

          {count >= 4 && (
            <div className="grid grid-cols-2 gap-0.5">
              <MosaicTile media={members[0]!} locale={locale} />
              <MosaicTile media={members[1]!} locale={locale} />
              <MosaicTile media={members[2]!} locale={locale} />
              <MosaicTile
                media={members[3]!}
                locale={locale}
                overlay={
                  count > 4 ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#0D131A]/55 text-lg font-semibold text-white">
                      +{count - 3}
                    </div>
                  ) : undefined
                }
              />
            </div>
          )}
        </div>
      </button>
      {title ? (
        <figcaption className="mt-2 text-center text-sm text-[#495867]">
          {title}
        </figcaption>
      ) : null}
    </figure>
  );
}
