"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { resolveThumbKind } from "@/lib/media-file-client";
import { GalleryImage } from "./GalleryImage";
import { useLocale } from "./LocaleProvider";

const AUTO_MS = 5000;

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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open) return;
    setIndex(initialIndex);
    setAutoPlay(initialAutoPlay);
  }, [open, initialIndex, initialAutoPlay]);

  const go = useCallback(
    (delta: number) => {
      if (items.length === 0) return;
      setIndex((i) => (i + delta + items.length) % items.length);
    },
    [items.length]
  );

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
      className="fixed inset-0 z-[100] flex flex-col bg-[#0D131A]/90"
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

      <div className="relative flex flex-1 items-center justify-center px-12 pb-8">
        {items.length > 1 && (
          <button
            type="button"
            aria-label={t("gallery.prev")}
            onClick={() => {
              setAutoPlay(false);
              go(-1);
            }}
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/15 px-3 py-2 text-xl text-white hover:bg-white/25 sm:left-4"
          >
            ‹
          </button>
        )}
        <div className="max-h-full w-full max-w-4xl">
          {currentKind === "VIDEO" ? (
            <video
              src={current.urlOrigin || current.url}
              controls
              className="mx-auto max-h-[70vh] w-full"
            />
          ) : currentKind === "DOCUMENT" ? (
            <div className="rounded-lg bg-white p-6 text-center text-[#0D131A]">
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
                className="mt-4 h-[50vh] w-full rounded border border-[#d4dde6]"
              />
            </div>
          ) : (
            <GalleryImage image={current} locale={locale} />
          )}
          {footer?.(current, index)}
        </div>
        {items.length > 1 && (
          <button
            type="button"
            aria-label={t("gallery.next")}
            onClick={() => {
              setAutoPlay(false);
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
