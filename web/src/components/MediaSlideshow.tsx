"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { resolveThumbKind } from "@/lib/media-file-client";
import {
  isHorizontalSwipeGesture,
  isVerticalScrollGesture,
  resolveHorizontalSwipe,
} from "@/lib/swipe-navigation";
import { GalleryImage } from "./GalleryImage";
import { useLocale } from "./LocaleProvider";

const AUTO_MS = 5000;
const SWIPE_SNAP_MS = 280;

export type MediaSlideshowItem = {
  kind?: string | null;
  mimeType?: string | null;
  urlOrigin?: string;
  url?: string;
  urlPicto?: string | null;
  urlPetite?: string | null;
  urlMoyenne?: string | null;
  urlGrande?: string | null;
  titleFr?: string;
  titleEn?: string;
  descriptionFr?: string;
  descriptionEn?: string;
  captionFr?: string;
  captionEn?: string;
  focusX?: number;
  focusY?: number;
  zoom?: number;
  rotation?: number;
  cropX?: number;
  cropY?: number;
  cropW?: number;
  cropH?: number;
};

type SnapTarget = "prev" | "center" | "next";

function lockBodyScroll() {
  const scrollY = window.scrollY;
  const prev = {
    bodyOverflow: document.body.style.overflow,
    htmlOverflow: document.documentElement.style.overflow,
    bodyPosition: document.body.style.position,
    bodyTop: document.body.style.top,
    bodyWidth: document.body.style.width,
    bodyTouchAction: document.body.style.touchAction,
  };

  document.body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";
  document.body.style.position = "fixed";
  document.body.style.top = `-${scrollY}px`;
  document.body.style.width = "100%";
  document.body.style.touchAction = "none";

  return () => {
    document.body.style.overflow = prev.bodyOverflow;
    document.documentElement.style.overflow = prev.htmlOverflow;
    document.body.style.position = prev.bodyPosition;
    document.body.style.top = prev.bodyTop;
    document.body.style.width = prev.bodyWidth;
    document.body.style.touchAction = prev.bodyTouchAction;
    window.scrollTo(0, scrollY);
  };
}

function SlidePanel({
  item,
  locale,
  footer,
  panelIndex,
  panelWidth,
}: {
  item: MediaSlideshowItem;
  locale: "fr" | "en";
  footer?: ReactNode;
  panelIndex: number;
  panelWidth: number;
}) {
  const { t } = useLocale();
  const kind = resolveThumbKind(
    item.kind,
    item.mimeType,
    item.urlOrigin || item.url
  );

  return (
    <div
      className="flex min-h-0 shrink-0 flex-col items-center justify-center"
      style={{ width: panelWidth > 0 ? panelWidth : "100%" }}
      aria-hidden={panelIndex !== 1}
    >
      {kind === "VIDEO" ? (
        <video
          src={item.urlOrigin || item.url}
          controls
          className="mx-auto max-h-[min(calc(100dvh-9rem),90vh)] w-full touch-auto"
        />
      ) : kind === "DOCUMENT" ? (
        <div
          data-slideshow-pdf-scroll
          className="max-h-[min(calc(100dvh-9rem),90vh)] w-full touch-pan-y overflow-auto rounded-lg bg-white p-6 text-center text-[#0D131A]"
        >
          <p className="mb-3 font-medium">
            {locale === "fr"
              ? item.titleFr || t("gallery.kind.document")
              : item.titleEn || t("gallery.kind.document")}
          </p>
          <a
            href={item.urlOrigin || item.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-md bg-[#495867] px-4 py-2 text-sm text-white"
          >
            {t("gallery.openPdf")}
          </a>
          <iframe
            title="pdf"
            src={item.urlOrigin || item.url}
            className="mt-4 h-[min(50vh,calc(100dvh-14rem))] w-full rounded border border-[#d4dde6]"
          />
        </div>
      ) : (
        <GalleryImage image={item} locale={locale} mode="slideshow" />
      )}
      {footer}
    </div>
  );
}

function getTrackTransform(
  dragX: number,
  snapTarget: SnapTarget | null,
  viewportWidth: number
): string {
  const w = viewportWidth > 0 ? viewportWidth : 0;
  if (snapTarget === "next") {
    return `translateX(${-2 * w}px)`;
  }
  if (snapTarget === "prev") {
    return "translateX(0px)";
  }
  if (snapTarget === "center") {
    return `translateX(${-w}px)`;
  }
  return `translateX(${-w + dragX}px)`;
}

export function MediaSlideshow({
  items,
  open,
  initialIndex = 0,
  initialAutoPlay = false,
  onClose,
  footer,
  locale: localeProp,
}: {
  items: MediaSlideshowItem[];
  open: boolean;
  initialIndex?: number;
  initialAutoPlay?: boolean;
  onClose: () => void;
  footer?: (item: MediaSlideshowItem, index: number) => ReactNode;
  locale?: "fr" | "en";
}) {
  const { locale: localeCtx, t } = useLocale();
  const locale = localeProp ?? localeCtx;
  const [index, setIndex] = useState(initialIndex);
  const [autoPlay, setAutoPlay] = useState(initialAutoPlay);
  const [dragX, setDragX] = useState(0);
  const [slideTransition, setSlideTransition] = useState(false);
  const [snapTarget, setSnapTarget] = useState<SnapTarget | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipeAreaRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const slideTrackRef = useRef<HTMLDivElement>(null);
  const isAnimatingRef = useRef(false);
  const [viewportWidth, setViewportWidth] = useState(0);

  useEffect(() => {
    if (!open) return;
    setIndex(initialIndex);
    setAutoPlay(initialAutoPlay);
    setDragX(0);
    setSlideTransition(false);
    setSnapTarget(null);
    isAnimatingRef.current = false;
  }, [open, initialIndex, initialAutoPlay]);

  useEffect(() => {
    if (!open) return;
    const viewport = viewportRef.current;
    if (!viewport) return;

    const updateWidth = () => {
      setViewportWidth(viewport.offsetWidth);
    };
    updateWidth();

    const ro = new ResizeObserver(updateWidth);
    ro.observe(viewport);
    return () => ro.disconnect();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    return lockBodyScroll();
  }, [open]);

  const go = useCallback(
    (delta: number) => {
      if (items.length === 0) return;
      setIndex((i) => (i + delta + items.length) % items.length);
    },
    [items.length]
  );

  const resetDrag = useCallback(() => {
    isAnimatingRef.current = false;
    setSlideTransition(false);
    setSnapTarget(null);
    setDragX(0);
  }, []);

  const finishSnap = useCallback(
    (target: SnapTarget) => {
      if (target === "next") {
        go(1);
      } else if (target === "prev") {
        go(-1);
      }
      isAnimatingRef.current = false;
      setSlideTransition(false);
      setSnapTarget(null);
      setDragX(0);
    },
    [go]
  );

  const onTrackTransitionEnd = useCallback(
    (e: React.TransitionEvent<HTMLDivElement>) => {
      if (e.propertyName !== "transform" || !snapTarget || snapTarget === "center") {
        if (snapTarget === "center") {
          isAnimatingRef.current = false;
          setSlideTransition(false);
          setSnapTarget(null);
          setDragX(0);
        }
        return;
      }
      finishSnap(snapTarget);
    },
    [finishSnap, snapTarget]
  );

  const onTouchStart = useCallback(
    (e: ReactTouchEvent<HTMLDivElement>) => {
      if (items.length < 2) return;
      if (isAnimatingRef.current) return;
      const touch = e.changedTouches[0] ?? e.touches[0];
      if (!touch) return;
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
      setSlideTransition(false);
      setSnapTarget(null);
    },
    [items.length]
  );

  const onTouchEnd = useCallback(
    (e: ReactTouchEvent<HTMLDivElement>) => {
      const start = touchStartRef.current;
      touchStartRef.current = null;
      if (items.length < 2 || !start || isAnimatingRef.current) return;
      const touch = e.changedTouches[0];
      if (!touch) return;

      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;
      const direction = resolveHorizontalSwipe({ deltaX, deltaY });

      if (direction === 0) {
        isAnimatingRef.current = true;
        setDragX(0);
        setSlideTransition(true);
        setSnapTarget("center");
        return;
      }

      setAutoPlay(false);
      isAnimatingRef.current = true;
      setDragX(0);
      setSlideTransition(true);
      setSnapTarget(direction === 1 ? "next" : "prev");
    },
    [items.length]
  );

  const onTouchCancel = useCallback(() => {
    touchStartRef.current = null;
    resetDrag();
  }, [resetDrag]);

  useEffect(() => {
    if (!open) return;
    const area = swipeAreaRef.current;
    if (!area) return;

    const onTouchMove = (e: TouchEvent) => {
      if (items.length < 2 || isAnimatingRef.current) return;
      const start = touchStartRef.current;
      if (!start) return;

      const touch = e.touches[0];
      if (!touch) return;

      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;
      const target = e.target;
      const inPdfScroll =
        target instanceof Element &&
        target.closest("[data-slideshow-pdf-scroll]");

      if (inPdfScroll && isVerticalScrollGesture({ deltaX, deltaY })) {
        return;
      }

      if (isHorizontalSwipeGesture({ deltaX, deltaY })) {
        e.preventDefault();
        setSlideTransition(false);
        setSnapTarget(null);
        setDragX(deltaX);
      }
    };

    area.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => area.removeEventListener("touchmove", onTouchMove);
  }, [open, items.length]);

  useEffect(() => {
    if (!open || !autoPlay || items.length < 2) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }
    timerRef.current = setInterval(() => go(1), AUTO_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [open, autoPlay, go, items.length, index]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setAutoPlay(false);
        onClose();
      }
      if (e.key === "ArrowLeft") {
        setAutoPlay(false);
        go(-1);
      }
      if (e.key === "ArrowRight") {
        setAutoPlay(false);
        go(1);
      }
      if (e.key === " ") {
        e.preventDefault();
        setAutoPlay((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go, onClose]);

  const current = items[index] ?? null;
  if (!open || !current) return null;

  const prevIndex = (index - 1 + items.length) % items.length;
  const nextIndex = (index + 1) % items.length;
  const multiSlide = items.length > 1;

  return (
    <div
      className="fixed inset-0 z-[100] flex touch-none flex-col bg-[#0D131A]/90"
      role="dialog"
      aria-modal="true"
      aria-label={t("gallery.slideshow")}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
        <p className="text-sm">
          {index + 1} / {items.length}
          {autoPlay ? ` · ${t("gallery.slideshow")}` : ""}
        </p>
        <div className="flex items-center gap-2">
          {items.length > 1 && (
            <button
              type="button"
              onClick={() => setAutoPlay((v) => !v)}
              className="rounded border border-white/30 px-3 py-1 text-xs hover:bg-white/10"
            >
              {autoPlay ? t("gallery.pause") : t("gallery.play")}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setAutoPlay(false);
              onClose();
            }}
            className="rounded border border-white/30 px-3 py-1 text-xs hover:bg-white/10"
          >
            {t("gallery.close")}
          </button>
        </div>
      </div>

      <div
        ref={swipeAreaRef}
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 pb-4 sm:px-12 sm:pb-8"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
      >
        {multiSlide && (
          <button
            type="button"
            aria-label={t("gallery.prev")}
            onClick={() => {
              setAutoPlay(false);
              resetDrag();
              go(-1);
            }}
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/15 px-3 py-2 text-xl text-white hover:bg-white/25 sm:left-4"
          >
            ‹
          </button>
        )}
        <div ref={viewportRef} className="min-h-0 w-full max-w-5xl overflow-hidden">
          <div
            ref={slideTrackRef}
            className="flex will-change-transform"
            style={{
              transform: multiSlide
                ? getTrackTransform(dragX, snapTarget, viewportWidth)
                : undefined,
              transition:
                slideTransition && multiSlide
                  ? `transform ${SWIPE_SNAP_MS}ms cubic-bezier(0.25, 0.1, 0.25, 1)`
                  : undefined,
            }}
            onTransitionEnd={onTrackTransitionEnd}
          >
            {multiSlide ? (
              <>
                <SlidePanel
                  item={items[prevIndex]!}
                  locale={locale}
                  panelIndex={0}
                  panelWidth={viewportWidth}
                />
                <SlidePanel
                  item={current}
                  locale={locale}
                  footer={footer?.(current, index)}
                  panelIndex={1}
                  panelWidth={viewportWidth}
                />
                <SlidePanel
                  item={items[nextIndex]!}
                  locale={locale}
                  panelIndex={2}
                  panelWidth={viewportWidth}
                />
              </>
            ) : (
              <SlidePanel
                item={current}
                locale={locale}
                footer={footer?.(current, index)}
                panelIndex={0}
                panelWidth={viewportWidth}
              />
            )}
          </div>
        </div>
        {multiSlide && (
          <button
            type="button"
            aria-label={t("gallery.next")}
            onClick={() => {
              setAutoPlay(false);
              resetDrag();
              go(1);
            }}
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/15 px-3 py-2 text-xl text-white hover:bg-white/25 sm:right-4"
          >
            ›
          </button>
        )}
      </div>
    </div>
  );
}

/** Local state helper for opening a media slideshow viewer. */
export function useMediaSlideshow() {
  const [open, setOpen] = useState(false);
  const [initialIndex, setInitialIndex] = useState(0);
  const [initialAutoPlay, setInitialAutoPlay] = useState(false);

  const openViewer = useCallback((i: number) => {
    setInitialIndex(i);
    setInitialAutoPlay(false);
    setOpen(true);
  }, []);

  const startSlideshow = useCallback((fromIndex = 0) => {
    setInitialIndex(fromIndex);
    setInitialAutoPlay(true);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  return {
    open,
    initialIndex,
    initialAutoPlay,
    openViewer,
    startSlideshow,
    close,
  };
}
