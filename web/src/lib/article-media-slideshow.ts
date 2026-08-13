"use client";

import { useCallback } from "react";
import { useMediaSlideshow } from "@/components/MediaSlideshow";

/** Slideshow state scoped to a unified article media manifest. */
export function useArticleMediaSlideshow() {
  const slideshow = useMediaSlideshow();

  const openAtGroup = useCallback(
    (groupId: string, indexByGroupId: Record<string, number>) => {
      const index = indexByGroupId[groupId];
      if (index !== undefined) {
        slideshow.openViewer(index);
      }
    },
    [slideshow]
  );

  const openAtMediaId = useCallback(
    (mediaId: string, manifest: Array<{ id?: string }>) => {
      const index = manifest.findIndex((item) => item.id === mediaId);
      if (index >= 0) {
        slideshow.openViewer(index);
      }
    },
    [slideshow]
  );

  return {
    ...slideshow,
    openAtGroup,
    openAtMediaId,
  };
}
