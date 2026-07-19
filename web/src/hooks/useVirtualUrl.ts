"use client";

import { useCallback, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { buildVirtualUrl, closeVirtualUrl } from "@/lib/virtual-url";

export function useVirtualUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openedViaPushRef = useRef(false);

  const markOpenedViaPush = useCallback(() => {
    openedViaPushRef.current = true;
  }, []);

  const pushVirtual = useCallback(
    (
      patch: Record<string, string | null | undefined>,
      keysToClear?: readonly string[]
    ) => {
      const url = buildVirtualUrl(pathname, searchParams, patch, keysToClear);
      router.push(url, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const replaceVirtual = useCallback(
    (
      patch: Record<string, string | null | undefined>,
      keysToClear?: readonly string[]
    ) => {
      const url = buildVirtualUrl(pathname, searchParams, patch, keysToClear);
      router.replace(url, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const closeVirtual = useCallback(
    (keysToClear: readonly string[]) => {
      const openedViaPush = openedViaPushRef.current;
      openedViaPushRef.current = false;
      closeVirtualUrl(
        router,
        pathname,
        searchParams,
        keysToClear,
        openedViaPush
      );
    },
    [router, pathname, searchParams]
  );

  return {
    pathname,
    searchParams,
    pushVirtual,
    replaceVirtual,
    closeVirtual,
    markOpenedViaPush,
  };
}
