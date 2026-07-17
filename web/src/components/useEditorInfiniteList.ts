"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EDITOR_LIST_PAGE_SIZE } from "@/lib/constants";
import type { EditorListPage } from "@/lib/editor-list";

type Options = {
  /** Base path e.g. `/api/tags` — query string without limit/offset is appended. */
  endpoint: string;
  /** Extra query string (filters), without leading `?`. Changes reset the list. */
  queryString?: string;
  pageSize?: number;
  enabled?: boolean;
};

export function useEditorInfiniteList<T>({
  endpoint,
  queryString = "",
  pageSize = EDITOR_LIST_PAGE_SIZE,
  enabled = true,
}: Options) {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [totalAll, setTotalAll] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const fetchGenRef = useRef(0);

  const fetchPage = useCallback(
    async (reset: boolean) => {
      if (!enabled) return;
      const gen = ++fetchGenRef.current;
      if (reset) {
        setLoading(true);
        setError(null);
        offsetRef.current = 0;
      } else {
        setLoadingMore(true);
      }

      const params = new URLSearchParams(queryString);
      params.set("limit", String(pageSize));
      params.set("offset", String(reset ? 0 : offsetRef.current));

      try {
        const res = await fetch(`${endpoint}?${params.toString()}`);
        if (!res.ok) throw new Error("fetch failed");
        const data = (await res.json()) as EditorListPage<T>;
        if (gen !== fetchGenRef.current) return;

        if (reset) {
          setItems(data.items);
        } else {
          setItems((prev) => [...prev, ...data.items]);
        }
        offsetRef.current = data.offset + data.items.length;
        setTotal(data.total);
        setTotalAll(data.totalAll);
      } catch {
        if (gen === fetchGenRef.current) {
          setError("LOAD_FAILED");
        }
      } finally {
        if (gen === fetchGenRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [enabled, endpoint, pageSize, queryString]
  );

  useEffect(() => {
    void fetchPage(true);
  }, [fetchPage]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !enabled) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0]?.isIntersecting &&
          !loading &&
          !loadingMore &&
          offsetRef.current < total
        ) {
          void fetchPage(false);
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled, fetchPage, loading, loadingMore, total]);

  const reload = useCallback(() => void fetchPage(true), [fetchPage]);

  return {
    items,
    total,
    totalAll,
    loading,
    loadingMore,
    error,
    setError,
    sentinelRef,
    reload,
  };
}
