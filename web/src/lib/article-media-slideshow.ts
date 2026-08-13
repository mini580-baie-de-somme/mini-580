"use client";

import { useCallback, useState } from "react";
import {
  useMediaSlideshow,
  type MediaSlideshowItem,
} from "@/components/MediaSlideshow";

/** Slideshow state with optional scoped items (inline group) vs full article manifest. */
export function useArticleMediaSlideshow() {
  const slideshow = useMediaSlideshow();
  const [scopeItems, setScopeItems] = useState<MediaSlideshowItem[] | null>(
    null
  );

  const openGroupMembers = useCallback(
    (members: MediaSlideshowItem[], startIndex = 0) => {
      if (members.length === 0) return;
      setScopeItems(members);
      slideshow.openViewer(startIndex);
    },
    [slideshow]
  );

  const openAtGroup = useCallback(
    (
      groupId: string,
      mediaGroups: Record<string, { members: MediaSlideshowItem[] }>,
      indexByGroupId: Record<string, number>
    ) => {
      const group = mediaGroups[groupId];
      if (group?.members.length) {
        openGroupMembers(group.members, 0);
        return;
      }
      const index = indexByGroupId[groupId];
      if (index !== undefined) {
        setScopeItems(null);
        slideshow.openViewer(index);
      }
    },
    [openGroupMembers, slideshow]
  );

  const openAtMediaId = useCallback(
    (mediaId: string, manifest: Array<{ id?: string }>) => {
      const index = manifest.findIndex((item) => item.id === mediaId);
      if (index >= 0) {
        setScopeItems(null);
        slideshow.openViewer(index);
      }
    },
    [slideshow]
  );

  const openViewer = useCallback(
    (index: number) => {
      setScopeItems(null);
      slideshow.openViewer(index);
    },
    [slideshow]
  );

  const startSlideshow = useCallback(
    (fromIndex = 0) => {
      setScopeItems(null);
      slideshow.startSlideshow(fromIndex);
    },
    [slideshow]
  );

  const close = useCallback(() => {
    setScopeItems(null);
    slideshow.close();
  }, [slideshow]);

  return {
    ...slideshow,
    scopeItems,
    openGroupMembers,
    openAtGroup,
    openAtMediaId,
    openViewer,
    startSlideshow,
    close,
  };
}
