"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { GalleryPhoto } from "@/lib/gallery-types";
import { resolveThumbKind } from "@/lib/media-file-client";
import { GalleryImage } from "./GalleryImage";
import { MediaKindThumb } from "./MediaKindThumb";
import { useLocale } from "./LocaleProvider";

type FilterOptions = {
  themes: { slug: string; labelFr: string; labelEn: string }[];
  tags: { name: string; labelFr: string; labelEn: string }[];
  milestones: { slug: string; titleFr: string; titleEn: string }[];
};

const AUTO_MS = 5000;

export function GalleryPageContent({
  photos,
  options,
}: {
  photos: GalleryPhoto[];
  options: FilterOptions;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale, t } = useLocale();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [slideshowOpen, setSlideshowOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sort = searchParams.get("sort") === "milestone" ? "milestone" : "date";

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      router.push(`/galerie?${params.toString()}`);
    },
    [router, searchParams]
  );

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    update("search", search.trim());
  }

  /** Open viewer without autoplay (manual browse). */
  const openViewer = useCallback((i: number) => {
    setIndex(i);
    setAutoPlay(false);
    setSlideshowOpen(true);
  }, []);

  /** Explicit slideshow mode — user opted in via Diaporama button. */
  const startSlideshow = useCallback((fromIndex = 0) => {
    if (photos.length === 0) return;
    setIndex(fromIndex);
    setAutoPlay(true);
    setSlideshowOpen(true);
  }, [photos.length]);

  const go = useCallback(
    (delta: number) => {
      if (photos.length === 0) return;
      setIndex((i) => (i + delta + photos.length) % photos.length);
    },
    [photos.length]
  );

  useEffect(() => {
    if (!slideshowOpen || !autoPlay || photos.length < 2) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }
    timerRef.current = setInterval(() => go(1), AUTO_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [slideshowOpen, autoPlay, go, photos.length, index]);

  useEffect(() => {
    if (!slideshowOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSlideshowOpen(false);
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
  }, [slideshowOpen, go]);

  const current = photos[index] ?? null;

  const emptyHint = useMemo(
    () => (photos.length === 0 ? t("gallery.empty") : null),
    [photos.length, t]
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#0D131A]">{t("gallery.title")}</h1>
        <p className="mt-2 text-[#495867]">{t("gallery.subtitle")}</p>
      </div>

      <div className="rounded-lg border border-[#d4dde6] bg-white/80 p-4 backdrop-blur-sm">
        <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("gallery.search")}
            className="flex-1 rounded-md border border-[#d4dde6] px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-[#495867] px-4 py-2 text-sm text-white hover:bg-[#3a4654]"
          >
            {t("gallery.filter")}
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-[#495867]">
            Type
          </span>
          {(
            [
              ["", t("media.kind.all")],
              ["IMAGE", t("gallery.kind.image")],
              ["DOCUMENT", t("gallery.kind.document")],
              ["VIDEO", t("gallery.kind.video")],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value || "all"}
              type="button"
              onClick={() => update("kind", value)}
              className={`rounded border px-2 py-1 text-xs ${
                (searchParams.get("kind") ?? "") === value
                  ? "border-[#495867] bg-[#495867] text-white"
                  : "border-[#d4dde6] bg-white text-[#495867]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-[#495867]">
            {t("gallery.sort")}
          </span>
          {(
            [
              ["date", "gallery.sortDate"],
              ["milestone", "gallery.sortMilestone"],
            ] as const
          ).map(([value, labelKey]) => (
            <button
              key={value}
              type="button"
              onClick={() => update("sort", value === "date" ? "" : value)}
              className={`rounded border px-2 py-1 text-xs ${
                sort === value
                  ? "border-[#495867] bg-[#495867] text-white"
                  : "border-[#d4dde6] bg-white text-[#495867]"
              }`}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-[#495867]">
            {t("blog.hull")}
          </span>
          {["268", "269", "270"].map((h) => (
            <button
              key={h}
              type="button"
              onClick={() =>
                update("hull", searchParams.get("hull") === h ? "" : h)
              }
              className={`rounded border px-2 py-1 text-xs ${
                searchParams.get("hull") === h
                  ? "border-[#495867] bg-[#495867] text-white"
                  : "border-[#d4dde6] bg-white text-[#495867]"
              }`}
            >
              #{h}
            </button>
          ))}
        </div>

        {options.themes.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-[#495867]">
              {t("blog.theme")}
            </span>
            {options.themes.map((theme) => (
              <button
                key={theme.slug}
                type="button"
                onClick={() =>
                  update(
                    "theme",
                    searchParams.get("theme") === theme.slug ? "" : theme.slug
                  )
                }
                className={`rounded border px-2 py-1 text-xs ${
                  searchParams.get("theme") === theme.slug
                    ? "border-[#495867] bg-[#495867] text-white"
                    : "border-[#d4dde6] bg-white text-[#495867]"
                }`}
              >
                {locale === "fr" ? theme.labelFr : theme.labelEn}
              </button>
            ))}
          </div>
        )}

        {options.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-[#495867]">
              {t("blog.tag")}
            </span>
            {options.tags.map((tag) => (
              <button
                key={tag.name}
                type="button"
                onClick={() =>
                  update(
                    "tag",
                    searchParams.get("tag") === tag.name ? "" : tag.name
                  )
                }
                className={`rounded border px-2 py-1 text-xs ${
                  searchParams.get("tag") === tag.name
                    ? "border-[#495867] bg-[#495867] text-white"
                    : "border-[#d4dde6] bg-white text-[#495867]"
                }`}
              >
                {locale === "fr" ? tag.labelFr : tag.labelEn}
              </button>
            ))}
          </div>
        )}

        {options.milestones.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-[#495867]">
              {t("gallery.milestone")}
            </span>
            {options.milestones.map((m) => (
              <button
                key={m.slug}
                type="button"
                onClick={() =>
                  update(
                    "milestone",
                    searchParams.get("milestone") === m.slug ? "" : m.slug
                  )
                }
                className={`rounded border px-2 py-1 text-xs ${
                  searchParams.get("milestone") === m.slug
                    ? "border-[#495867] bg-[#495867] text-white"
                    : "border-[#d4dde6] bg-white text-[#495867]"
                }`}
              >
                {locale === "fr" ? m.titleFr : m.titleEn}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#495867]">
          {t("gallery.count").replace("{n}", String(photos.length))}
        </p>
        {photos.length > 0 && (
          <button
            type="button"
            onClick={() => startSlideshow(0)}
            className="rounded-md border border-[#495867] bg-[#495867] px-3 py-1.5 text-sm text-white hover:bg-[#3a4654]"
          >
            {t("gallery.startSlideshow")}
          </button>
        )}
      </div>

      {emptyHint ? (
        <p className="mt-8 text-center text-[#495867]">{emptyHint}</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {photos.map((photo, i) => {
            const title =
              locale === "fr"
                ? photo.titleFr || photo.post.titleFr
                : photo.titleEn || photo.post.titleEn;
            const displayKind = resolveThumbKind(
              photo.kind,
              photo.mimeType,
              photo.thumbUrl || photo.urlOrigin
            );
            const imageSrc =
              photo.thumbUrl ||
              photo.urlPetite ||
              photo.urlPicto ||
              photo.urlOrigin;
            return (
              <button
                key={photo.id}
                type="button"
                onClick={() => openViewer(i)}
                className="group overflow-hidden rounded-lg border border-[#d4dde6] bg-white text-left shadow-sm transition hover:border-[#495867]"
              >
                <div className="aspect-square overflow-hidden bg-[#eef3f7]">
                  {displayKind === "IMAGE" && imageSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageSrc}
                      alt={title}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-[#495867]">
                      <MediaKindThumb
                        kind={displayKind}
                        mimeType={photo.mimeType}
                        src={null}
                        size="md"
                        className="h-16 w-16 bg-transparent"
                      />
                      <span className="text-[10px] uppercase tracking-wide">
                        {displayKind === "DOCUMENT"
                          ? "PDF"
                          : t("gallery.kind.video")}
                      </span>
                    </div>
                  )}
                </div>
                <div className="px-2 py-2">
                  <p className="truncate text-xs font-medium text-[#0D131A]">
                    {title || t("gallery.untitled")}
                  </p>
                  {(photo.takenAt || photo.post.publishedAt) && (
                    <p className="mt-0.5 text-[10px] text-[#495867]">
                      {new Date(
                        photo.takenAt || photo.post.publishedAt!
                      ).toLocaleDateString(
                        locale === "fr" ? "fr-FR" : "en-GB",
                        { day: "numeric", month: "short", year: "numeric" }
                      )}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {slideshowOpen && current && (
        <div
          className="fixed inset-0 z-[100] flex flex-col bg-[#0D131A]/90"
          role="dialog"
          aria-modal="true"
          aria-label={t("gallery.slideshow")}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
            <p className="text-sm">
              {index + 1} / {photos.length}
              {autoPlay ? ` · ${t("gallery.slideshow")}` : ""}
            </p>
            <div className="flex items-center gap-2">
              {photos.length > 1 && (
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
                  setSlideshowOpen(false);
                }}
                className="rounded border border-white/30 px-3 py-1 text-xs hover:bg-white/10"
              >
                {t("gallery.close")}
              </button>
            </div>
          </div>

          <div className="relative flex flex-1 items-center justify-center px-12 pb-8">
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
            <div className="max-h-full w-full max-w-4xl">
              {(() => {
                const currentKind = resolveThumbKind(
                  current.kind,
                  current.mimeType,
                  current.urlOrigin
                );
                if (currentKind === "VIDEO") {
                  return (
                    <video
                      src={current.urlOrigin}
                      controls
                      className="mx-auto max-h-[70vh] w-full"
                    />
                  );
                }
                if (currentKind === "DOCUMENT") {
                  return (
                    <div className="rounded-lg bg-white p-6 text-center text-[#0D131A]">
                      <p className="mb-3 font-medium">
                        {locale === "fr"
                          ? current.titleFr || t("gallery.kind.document")
                          : current.titleEn || t("gallery.kind.document")}
                      </p>
                      <a
                        href={current.urlOrigin}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md bg-[#495867] px-4 py-2 text-sm text-white"
                      >
                        {t("gallery.openPdf")}
                      </a>
                      <iframe
                        title="pdf"
                        src={current.urlOrigin}
                        className="mt-4 h-[50vh] w-full rounded border border-[#d4dde6]"
                      />
                    </div>
                  );
                }
                return <GalleryImage image={current} locale={locale} />;
              })()}
              <div className="mt-3 text-center text-sm text-white/90">
                <Link
                  href={`/blog/${current.post.slug}`}
                  className="underline hover:text-white"
                >
                  {locale === "fr" ? current.post.titleFr : current.post.titleEn}
                </Link>
              </div>
            </div>
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
          </div>
        </div>
      )}
    </div>
  );
}
