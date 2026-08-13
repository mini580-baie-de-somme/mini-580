"use client";

import { useEffect, useMemo, useState } from "react";
import { parseMediaGroupIds } from "@/lib/media-group-token";
import {
  mediaGroupIdHint,
  MEDIA_GROUP_UPDATED_EVENT,
  resolveMediaGroupDisplayName,
} from "@/lib/media-group-display";
import { useLocale } from "./LocaleProvider";

type GroupMeta = {
  titleFr: string;
  titleEn: string;
  slug: string;
  memberCount: number;
};

/** Read-only chips mapping body placeholders to live group titles (markdown assist). */
export function MediaGroupBodyHints({ body }: { body: string }) {
  const { locale, t } = useLocale();
  const groupIds = useMemo(() => parseMediaGroupIds(body), [body]);
  const [metaById, setMetaById] = useState<Record<string, GroupMeta | null>>(
    {}
  );

  useEffect(() => {
    if (groupIds.length === 0) {
      setMetaById({});
      return;
    }

    let cancelled = false;

    const load = async () => {
      const entries = await Promise.all(
        groupIds.map(async (groupId) => {
          try {
            const res = await fetch(`/api/media-groups/${groupId}`);
            if (!res.ok) return [groupId, null] as const;
            const data = (await res.json()) as GroupMeta;
            return [groupId, data] as const;
          } catch {
            return [groupId, null] as const;
          }
        })
      );
      if (cancelled) return;
      setMetaById(Object.fromEntries(entries));
    };

    void load();

    const onUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ groupId?: string }>).detail;
      if (!detail?.groupId || !groupIds.includes(detail.groupId)) return;
      void load();
    };

    window.addEventListener(MEDIA_GROUP_UPDATED_EVENT, onUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener(MEDIA_GROUP_UPDATED_EVENT, onUpdated);
    };
  }, [groupIds]);

  if (groupIds.length === 0) return null;

  return (
    <div className="rounded-md border border-[#d4dde6] bg-[#f4f7fa] px-3 py-2">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#495867]/80">
        {t("mediaGroup.bodyHintsTitle")}
      </p>
      <ul className="flex flex-col gap-1.5">
        {groupIds.map((groupId) => {
          const meta = metaById[groupId];
          const name = meta
            ? resolveMediaGroupDisplayName(meta, locale, groupId)
            : t("mediaGroup.loadingChip");
          const count =
            meta &&
            (locale === "fr"
              ? `${meta.memberCount} média${meta.memberCount !== 1 ? "s" : ""}`
              : `${meta.memberCount} media item${meta.memberCount !== 1 ? "s" : ""}`);

          return (
            <li
              key={groupId}
              className="flex flex-wrap items-center gap-2 text-xs text-[#495867]"
            >
              <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-[#0D131A]">
                {`{{media-group:${groupId}}}`}
              </code>
              <span aria-hidden className="text-[#b0bcc8]">
                →
              </span>
              <span className="inline-flex min-w-0 items-center gap-1 rounded-full border border-[#495867]/25 bg-white px-2 py-0.5 text-[#495867]">
                <span aria-hidden>📷</span>
                <span className="truncate font-medium">{name}</span>
                {count ? (
                  <span className="text-[#495867]/70">· {count}</span>
                ) : null}
                <span className="font-mono text-[10px] text-[#495867]/60">
                  #{mediaGroupIdHint(groupId)}
                </span>
              </span>
              {meta === null ? (
                <span className="text-amber-700">{t("mediaGroup.missingChip")}</span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
