"use client";

import {
  extractMediaLinkInfo,
  mediaLinkLabel,
  type MediaLinkInfo,
} from "@/lib/media-links";

type MediaLike = {
  titleFr: string;
  titleEn: string;
  id: string;
  posts?: Array<{
    isCover: boolean;
    post: {
      id: string;
      titleFr: string;
      titleEn: string;
      slug: string;
      status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    };
  }>;
  groupMembers?: Array<{
    group: {
      id: string;
      titleFr: string;
      titleEn: string;
      slug: string;
    };
  }>;
  links?: MediaLinkInfo;
};

type Props = {
  media: MediaLike;
  locale: "fr" | "en";
  labels: {
    intro: string;
    coverSection: string;
    groupSection: string;
    legacyNote: string;
    simple: string;
  };
};

function resolveLinks(media: MediaLike): MediaLinkInfo {
  if (media.links) return media.links;
  return extractMediaLinkInfo({
    posts: media.posts ?? [],
    groupMembers: media.groupMembers ?? [],
  });
}

/** Structured delete confirmation body — cover links + group links (not lumped as "articles"). */
export function MediaDeleteConfirmMessage({ media, locale, labels }: Props) {
  const name =
    locale === "fr"
      ? media.titleFr || media.id
      : media.titleEn || media.id;
  const links = resolveLinks(media);
  const coverNames = links.coverLinks.map((l) => mediaLinkLabel(l, locale));
  const groupNames = links.groups.map((g) => mediaLinkLabel(g, locale));
  const hasBlocking =
    links.coverLinks.length > 0 || links.groups.length > 0;

  if (!hasBlocking) {
    return <p>{labels.simple.replace("{name}", name)}</p>;
  }

  return (
    <div className="space-y-2">
      <p>{labels.intro.replace("{name}", name)}</p>
      {links.coverLinks.length > 0 && (
        <div>
          <p className="font-medium text-[#0D131A]">
            {labels.coverSection.replace("{n}", String(links.coverLinks.length))}
          </p>
          <ul className="mt-1 list-inside list-disc text-[#495867]">
            {coverNames.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </div>
      )}
      {links.groups.length > 0 && (
        <div>
          <p className="font-medium text-[#0D131A]">
            {labels.groupSection.replace("{n}", String(links.groups.length))}
          </p>
          <ul className="mt-1 list-inside list-disc text-[#495867]">
            {groupNames.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </div>
      )}
      {links.legacyPostLinkCount > 0 && (
        <p className="text-xs text-[#495867]">
          {labels.legacyNote.replace("{n}", String(links.legacyPostLinkCount))}
        </p>
      )}
    </div>
  );
}
