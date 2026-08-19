"use client";

import { useEffect, useMemo, useState } from "react";
import {
  enrichExternalLinkTokens,
  parseExternalLinkIds,
  type ExternalLinkTokenMeta,
} from "@/lib/external-link-token";
import {
  EXTERNAL_LINK_UPDATED_EVENT,
  resolveExternalLinkDisplayName,
} from "@/lib/external-link-display";

type LinkApiMeta = ExternalLinkTokenMeta & {
  labelFr: string;
  labelEn: string;
  url: string | null;
  urlFr: string | null;
  urlEn: string | null;
};

/** Fetch link metadata and enrich body tokens in-place (editor sur-charge). */
export function useExternalLinkBodyEnrichment(
  body: string,
  locale: "fr" | "en",
  onEnriched: (next: string) => void
): void {
  const linkIds = useMemo(() => parseExternalLinkIds(body), [body]);
  const linkIdsKey = linkIds.join(",");
  const [metaById, setMetaById] = useState<
    Record<string, LinkApiMeta | null>
  >({});

  useEffect(() => {
    if (linkIds.length === 0) {
      setMetaById({});
      return;
    }

    let cancelled = false;

    const load = async () => {
      const entries = await Promise.all(
        linkIds.map(async (linkId) => {
          try {
            const res = await fetch(`/api/external-links/${linkId}`);
            if (!res.ok) return [linkId, null] as const;
            const data = (await res.json()) as LinkApiMeta;
            return [linkId, data] as const;
          } catch {
            return [linkId, null] as const;
          }
        })
      );
      if (cancelled) return;
      setMetaById(Object.fromEntries(entries));
    };

    void load();

    const onUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ linkId?: string }>).detail;
      if (!detail?.linkId || !linkIds.includes(detail.linkId)) return;
      void load();
    };

    window.addEventListener(EXTERNAL_LINK_UPDATED_EVENT, onUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener(EXTERNAL_LINK_UPDATED_EVENT, onUpdated);
    };
  }, [linkIdsKey, linkIds]);

  useEffect(() => {
    if (linkIds.length === 0) return;
    const enriched = enrichExternalLinkTokens(
      body,
      metaById,
      locale,
      resolveExternalLinkDisplayName
    );
    if (enriched !== body) onEnriched(enriched);
  }, [body, linkIds.length, locale, metaById, onEnriched]);
}
