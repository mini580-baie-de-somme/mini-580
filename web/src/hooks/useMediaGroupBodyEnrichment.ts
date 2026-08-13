"use client";

import { useEffect, useMemo, useState } from "react";
import {
  enrichMediaGroupTokens,
  parseMediaGroupIds,
  type MediaGroupTokenMeta,
} from "@/lib/media-group-token";
import {
  MEDIA_GROUP_UPDATED_EVENT,
  resolveMediaGroupDisplayName,
} from "@/lib/media-group-display";

type GroupApiMeta = MediaGroupTokenMeta & {
  titleFr: string;
  titleEn: string;
  slug: string;
};

/** Fetch group metadata and enrich body tokens in-place (editor sur-charge). */
export function useMediaGroupBodyEnrichment(
  body: string,
  locale: "fr" | "en",
  onEnriched: (next: string) => void
): void {
  const groupIds = useMemo(() => parseMediaGroupIds(body), [body]);
  const groupIdsKey = groupIds.join(",");
  const [metaById, setMetaById] = useState<
    Record<string, GroupApiMeta | null>
  >({});

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
            const data = (await res.json()) as GroupApiMeta;
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
  }, [groupIdsKey, groupIds]);

  useEffect(() => {
    if (groupIds.length === 0) return;
    const enriched = enrichMediaGroupTokens(
      body,
      metaById,
      locale,
      resolveMediaGroupDisplayName
    );
    if (enriched !== body) onEnriched(enriched);
  }, [body, groupIds.length, locale, metaById, onEnriched]);
}
