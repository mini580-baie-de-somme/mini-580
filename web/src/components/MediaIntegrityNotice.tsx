"use client";

import type { MouseEvent } from "react";
import type { MediaIntegrity } from "@/lib/media-integrity-types";
import {
  collectExternalMediaUrls,
  externalUrlRoleLabel,
  type MediaExternalUrl,
} from "@/lib/media-integrity-shared";

type UrlSource = {
  urlOrigin: string;
  urlPicto?: string | null;
  urlPetite?: string | null;
  urlMoyenne?: string | null;
  urlGrande?: string | null;
};

type Props = {
  integrity?: MediaIntegrity | null;
  media?: UrlSource | null;
  locale: "fr" | "en";
  /** Short links only (list audit column). */
  compact?: boolean;
  /** Amber panel before layout editor opens. */
  panel?: boolean;
  message?: string;
  className?: string;
  onLinkClick?: (event: MouseEvent) => void;
};

function resolveExternalUrls(
  integrity: MediaIntegrity | null | undefined,
  media: UrlSource | null | undefined
): MediaExternalUrl[] {
  if (integrity?.externalUrls?.length) return integrity.externalUrls;
  if (media) return collectExternalMediaUrls(media);
  return [];
}

export function MediaExternalUrlLinks({
  urls,
  locale,
  compact = false,
  onLinkClick,
}: {
  urls: MediaExternalUrl[];
  locale: "fr" | "en";
  compact?: boolean;
  onLinkClick?: (event: MouseEvent) => void;
}) {
  if (urls.length === 0) return null;

  return (
    <ul className={compact ? "space-y-0.5" : "mt-2 space-y-1.5"}>
      {urls.map(({ role, url }) => (
        <li key={`${role}:${url}`} className="min-w-0">
          <span className="text-[10px] text-[#495867]">
            {externalUrlRoleLabel(role, locale)}
            {compact ? " · " : " — "}
          </span>
          <a
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            onClick={onLinkClick}
            className={`break-all text-[#2563eb] underline decoration-[#2563eb]/40 underline-offset-2 hover:decoration-[#2563eb] ${
              compact ? "text-[10px]" : "text-xs"
            }`}
          >
            {url}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function MediaIntegrityNotice({
  integrity,
  media,
  locale,
  compact = false,
  panel = false,
  message,
  className = "",
  onLinkClick,
}: Props) {
  const externalUrls = resolveExternalUrls(integrity, media);
  const showPanel = panel && (message || externalUrls.length > 0);
  const showCompactLinks = compact && externalUrls.length > 0;

  if (!showPanel && !showCompactLinks) return null;

  if (compact) {
    return (
      <div className={className}>
        <MediaExternalUrlLinks
          urls={externalUrls}
          locale={locale}
          compact
          onLinkClick={onLinkClick}
        />
      </div>
    );
  }

  return (
    <div
      className={`rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 ${className}`}
    >
      {message ? <p>{message}</p> : null}
      {externalUrls.length > 0 && (
        <>
          <p className={message ? "mt-2 font-medium" : "font-medium"}>
            {locale === "fr"
              ? externalUrls.length > 1
                ? "URLs externes enregistrées — ouvrir pour re-téléverser :"
                : "URL externe enregistrée — ouvrir pour re-téléverser :"
              : externalUrls.length > 1
                ? "External URLs on record — open to re-upload:"
                : "External URL on record — open to re-upload:"}
          </p>
          <MediaExternalUrlLinks
            urls={externalUrls}
            locale={locale}
            onLinkClick={onLinkClick}
          />
        </>
      )}
    </div>
  );
}
