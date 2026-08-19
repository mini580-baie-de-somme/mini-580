"use client";

import type { PublicExternalLink } from "@/lib/article-media-types";
import { resolveExternalLinkUrl } from "@/lib/external-link-token";
import { useLocale } from "./LocaleProvider";

export function InlineExternalLink({
  link,
  locale,
}: {
  link: PublicExternalLink | null;
  locale: "fr" | "en";
}) {
  const { t } = useLocale();

  if (!link) {
    return (
      <div className="my-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {t("externalLink.missingChip")}
      </div>
    );
  }

  const label = locale === "fr" ? link.labelFr : link.labelEn;
  const href = resolveExternalLinkUrl(link, locale);

  if (!href) {
    return (
      <div className="my-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {t("externalLink.missingUrl")}
      </div>
    );
  }

  return (
    <div className="my-3">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-md border border-[#495867] bg-[#eef3f7] px-4 py-2 text-sm font-medium text-[#495867] transition hover:bg-[#495867] hover:text-white"
      >
        <span aria-hidden>🔗</span>
        <span>{label}</span>
        <span className="text-xs opacity-70" aria-hidden>
          ↗
        </span>
      </a>
    </div>
  );
}
