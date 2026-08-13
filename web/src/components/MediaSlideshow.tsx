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
  getSwipeSnapTranslateX,
  isHorizontalSwipeGesture,
  isVerticalScrollGesture,
  resolveHorizontalSwipe,
} from "@/lib/swipe-navigation";
import { GalleryImage } from "./GalleryImage";
import { useLocale } from "./LocaleProvider";

const AUTO_MS = 5000;
const SWIPE_SNAP_MS = 220;

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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipeAreaRef = useRef<HTMLDivElement>(null);
  const slideTrackRef = useRef<HTMLDivElement>(null);
  const snapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    setIndex(initialIndex);
    setAutoPlay(initialAutoPlay);
    setDragX(0);
    setSlideTransition(false);
  }, [open, initialIndex, initialAutoPlay]);

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
    if (snapTimerRef.current) {
      clearTimeout(snapTimerRef.current);
      snapTimerRef.current = null;
    }
    setSlideTransition(false);
    setDragX(0);
  }, []);

  const onTouchStart = useCallback(
    (e: ReactTouchEvent<HTMLDivElement>) => {
      if (items.length < 2) return;
      if (snapTimerRef.current) return;
      const touch = e.changedTouches[0] ?? e.touches[0];
      if (!touch) return;
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
      setSlideTransition(false);
    },
    [items.length]
  );

  const onTouchEnd = useCallback(
    (e: ReactTouchEvent<HTMLDivElement>) => {
      const start = touchStartRef.current;
      touchStartRef.current = null;
      if (items.length < 2 || !start) return;
      const touch = e.changedTouches[0];
      if (!touch) return;

      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;
      const direction = resolveHorizontalSwipe({ deltaX, deltaY });
      const trackWidth = slideTrackRef.current?.offsetWidth ?? 0;

      if (direction === 0) {
        setSlideTransition(true);
        setDragX(0);
        return;
      }

      setAutoPlay(false);
      setSlideTransition(true);
      setDragX(getSwipeSnapTranslateX(direction, trackWidth));

      snapTimerRef.current = setTimeout(() => {
        snapTimerRef.current = null;
        setSlideTransition(false);
        setDragX(0);
        go(direction);
      }, SWIPE_SNAP_MS);
    },
    [go, items.length]
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
      if (items.length < 2 || snapTimerRef.current) return;
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
        setDragX(deltaX);
      }
    };

    area.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => area.removeEventListener("touchmove", onTouchMove);
  }, [open, items.length]);

  useEffect(() => {
    return () => {
      if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
    };
  }, []);

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

  const currentKind = resolveThumbKind(
    current.kind,
    current.mimeType,
    current.urlOrigin || current.url
  );

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
        {items.length > 1 && (
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
        <div
          ref={slideTrackRef}
          className="flex min-h-0 w-full max-w-5xl flex-col items-center justify-center will-change-transform"
          style={{
            transform: `translateX(${dragX}px)`,
            transition: slideTransition
              ? `transform ${SWIPE_SNAP_MS}ms ease-out`
              : undefined,
          }}
        >
          {currentKind === "VIDEO" ? (
            <video
              src={current.urlOrigin || current.url}
              controls
              className="mx-auto max-h-[min(calc(100dvh-9rem),90vh)] w-full touch-auto"
            />
          ) : currentKind === "DOCUMENT" ? (
            <div
              data-slideshow-pdf-scroll
              className="max-h-[min(calc(100dvh-9rem),90vh)] w-full touch-pan-y overflow-auto rounded-lg bg-white p-6 text-center text-[#0D131A]"
            >
              <p className="mb-3 font-medium">
                {locale === "fr"
                  ? current.titleFr || t("gallery.kind.document")
                  : current.titleEn || t("gallery.kind.document")}
              </p>
              <a
                href={current.urlOrigin || current.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-md bg-[#495867] px-4 py-2 text-sm text-white"
              >
                {t("gallery.openPdf")}
              </a>
              <iframe
                title="pdf"
                src={current.urlOrigin || current.url}
                className="mt-4 h-[min(50vh,calc(100dvh-14rem))] w-full rounded border border-[#d4dde6]"
              />
            </div>
          ) : (
            <GalleryImage image={current} locale={locale} mode="slideshow" />
          )}
          {footer?.(current, index)}
        </div>
        {items.length > 1 && (
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
