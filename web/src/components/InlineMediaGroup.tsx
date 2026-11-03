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
  onOpen,
  ariaLabel,
}: {
  media: MosaicMedia;
  locale: "fr" | "en";
  className?: string;
  overlay?: ReactNode;
  onOpen?: () => void;
  ariaLabel?: string;
}) {
  const kind = resolveThumbKind(media.kind, media.mimeType, media.urlOrigin);
  const src = thumbSrc(media);
  const label =
    (locale === "fr" ? media.titleFr : media.titleEn) || "";

  const body = (
    <>
      {kind === "IMAGE" && src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
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
    </>
  );

  const tileClass = `relative aspect-square overflow-hidden bg-[#eef3f7] ${className}`;

  if (onOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label={ariaLabel}
        className={`${tileClass} transition hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#495867]`}
      >
        {body}
      </button>
    );
  }

  return <div className={tileClass}>{body}</div>;
}

export function InlineMediaGroup({
  group,
  locale,
  onOpen,
}: {
  group: PublicMediaGroup | null;
  locale: "fr" | "en";
  manifestIndex?: number;
  onOpen: (startIndex: number) => void;
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

  if (count === 0) {
    return (
      <div className="my-6 rounded-lg border border-dashed border-[#d4dde6] bg-[#f8fafc] px-4 py-6 text-center text-sm text-[#495867]">
        {locale === "fr" ? "Groupe vide." : "Empty group."}
      </div>
    );
  }

  const tileAria = (index: number) => {
    const n = index + 1;
    if (locale === "fr") {
      return `Voir média ${n} sur ${count}${title ? ` — ${title}` : ""}`;
    }
    return `View media ${n} of ${count}${title ? ` — ${title}` : ""}`;
  };

  const openAt = (index: number) => () => onOpen(index);

  return (
    <figure className="my-6 w-full sm:my-8">
      <div className="w-full overflow-hidden rounded-xl border border-[#d4dde6] shadow-sm">
        <div className="w-full overflow-hidden">
          {count === 1 && (
            <MosaicTile
              media={members[0]!}
              locale={locale}
              className="w-full"
              onOpen={openAt(0)}
              ariaLabel={tileAria(0)}
            />
          )}

          {count === 2 && (
            <div className="grid grid-cols-2 gap-0.5">
              <MosaicTile
                media={members[0]!}
                locale={locale}
                onOpen={openAt(0)}
                ariaLabel={tileAria(0)}
              />
              <MosaicTile
                media={members[1]!}
                locale={locale}
                onOpen={openAt(1)}
                ariaLabel={tileAria(1)}
              />
            </div>
          )}

          {count === 3 && (
            <div className="grid grid-cols-3 gap-0.5">
              <MosaicTile
                media={members[0]!}
                locale={locale}
                onOpen={openAt(0)}
                ariaLabel={tileAria(0)}
              />
              <MosaicTile
                media={members[1]!}
                locale={locale}
                onOpen={openAt(1)}
                ariaLabel={tileAria(1)}
              />
              <MosaicTile
                media={members[2]!}
                locale={locale}
                onOpen={openAt(2)}
                ariaLabel={tileAria(2)}
              />
            </div>
          )}

          {count >= 4 && (
            <div className="grid grid-cols-2 gap-0.5">
              <MosaicTile
                media={members[0]!}
                locale={locale}
                onOpen={openAt(0)}
                ariaLabel={tileAria(0)}
              />
              <MosaicTile
                media={members[1]!}
                locale={locale}
                onOpen={openAt(1)}
                ariaLabel={tileAria(1)}
              />
              <MosaicTile
                media={members[2]!}
                locale={locale}
                onOpen={openAt(2)}
                ariaLabel={tileAria(2)}
              />
              <MosaicTile
                media={members[3]!}
                locale={locale}
                onOpen={openAt(3)}
                ariaLabel={tileAria(3)}
                overlay={
                  count > 4 ? (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#0D131A]/55 text-lg font-semibold text-white">
                      +{count - 3}
                    </div>
                  ) : undefined
                }
              />
            </div>
          )}
        </div>
      </div>
      {title ? (
        <figcaption className="mt-2 text-center text-sm text-[#495867]">
          {title}
        </figcaption>
      ) : null}
    </figure>
  );
}
