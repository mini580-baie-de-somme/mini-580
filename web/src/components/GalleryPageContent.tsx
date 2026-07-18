"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import type { GalleryPhoto } from "@/lib/gallery-types";
import { countListFilters } from "@/lib/editor-list";
import { resolveThumbKind } from "@/lib/media-file-client";
import { MediaKindThumb } from "./MediaKindThumb";
import { MediaSlideshow, useMediaSlideshow } from "./MediaSlideshow";
import {
  EditorFilterChip,
  EditorFilterGroup,
  EditorListToolbar,
  type EditorListActiveChip,
} from "./EditorListToolbar";
import { useLocale } from "./LocaleProvider";

type FilterOptions = {
  themes: { slug: string; labelFr: string; labelEn: string }[];
  tags: { name: string; labelFr: string; labelEn: string }[];
  milestones: { slug: string; titleFr: string; titleEn: string }[];
};

const FILTER_KEYS = [
  "search",
  "kind",
  "sort",
  "hull",
  "theme",
  "tag",
  "milestone",
];

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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const slideshow = useMediaSlideshow();

  const sort = searchParams.get("sort") === "milestone" ? "milestone" : "date";
  const activeCount = countListFilters(searchParams, FILTER_KEYS);

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      router.push(`/galerie?${params.toString()}`);
    },
    [router, searchParams]
  );

  const emptyHint = useMemo(
    () => (photos.length === 0 ? t("gallery.empty") : null),
    [photos.length, t]
  );

  const activeChips = useMemo((): EditorListActiveChip[] => {
    const chips: EditorListActiveChip[] = [];
    const search = searchParams.get("search")?.trim();
    if (search) {
      chips.push({
        key: "search",
        prefix: t("editor.filters.search"),
        label: search,
      });
    }

    const kind = searchParams.get("kind");
    if (kind === "IMAGE") {
      chips.push({
        key: "kind",
        prefix: t("media.colKind"),
        label: t("gallery.kind.image"),
      });
    } else if (kind === "DOCUMENT") {
      chips.push({
        key: "kind",
        prefix: t("media.colKind"),
        label: t("gallery.kind.document"),
      });
    } else if (kind === "VIDEO") {
      chips.push({
        key: "kind",
        prefix: t("media.colKind"),
        label: t("gallery.kind.video"),
      });
    }

    if (sort === "milestone") {
      chips.push({
        key: "sort",
        prefix: t("gallery.sort").replace(":", ""),
        label: t("gallery.sortMilestone"),
      });
    }

    const hull = searchParams.get("hull");
    if (hull) {
      chips.push({
        key: "hull",
        prefix: t("blog.hull").replace(":", ""),
        label: `#${hull}`,
      });
    }

    const themeSlug = searchParams.get("theme");
    if (themeSlug) {
      const theme = options.themes.find((item) => item.slug === themeSlug);
      chips.push({
        key: "theme",
        prefix: t("blog.theme").replace(":", ""),
        label: theme
          ? locale === "fr"
            ? theme.labelFr
            : theme.labelEn
          : themeSlug,
      });
    }

    const tagName = searchParams.get("tag");
    if (tagName) {
      const tag = options.tags.find((item) => item.name === tagName);
      chips.push({
        key: "tag",
        prefix: t("blog.tag").replace(":", ""),
        label: tag ? (locale === "fr" ? tag.labelFr : tag.labelEn) : tagName,
      });
    }

    const milestoneSlug = searchParams.get("milestone");
    if (milestoneSlug) {
      const m = options.milestones.find((item) => item.slug === milestoneSlug);
      chips.push({
        key: "milestone",
        prefix: t("gallery.milestone").replace(":", ""),
        label: m
          ? locale === "fr"
            ? m.titleFr
            : m.titleEn
          : milestoneSlug,
      });
    }

    return chips;
  }, [locale, options.milestones, options.tags, options.themes, searchParams, sort, t]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#0D131A]">{t("gallery.title")}</h1>
        <p className="mt-2 text-[#495867]">{t("gallery.subtitle")}</p>
      </div>

      <EditorListToolbar
        searchValue={searchParams.get("search") ?? ""}
        searchPlaceholder={t("gallery.search")}
        onSearchSubmit={(q) => update("search", q)}
        activeChips={activeChips}
        onRemoveChip={(key) => update(key, "")}
        onClearAll={() => router.push("/galerie")}
        filtersOpen={filtersOpen}
        onFiltersOpenChange={setFiltersOpen}
        activeFilterCount={activeCount}
        filterPanel={
          <>
            <EditorFilterGroup label={t("media.colKind")}>
              {(
                [
                  ["", t("media.kind.all")],
                  ["IMAGE", t("gallery.kind.image")],
                  ["DOCUMENT", t("gallery.kind.document")],
                  ["VIDEO", t("gallery.kind.video")],
                ] as const
              ).map(([value, label]) => (
                <EditorFilterChip
                  key={value || "all"}
                  active={(searchParams.get("kind") ?? "") === value}
                  onClick={() => update("kind", value)}
                >
                  {label}
                </EditorFilterChip>
              ))}
            </EditorFilterGroup>

            <EditorFilterGroup label={t("gallery.sort")}>
              {(
                [
                  ["date", "gallery.sortDate"],
                  ["milestone", "gallery.sortMilestone"],
                ] as const
              ).map(([value, labelKey]) => (
                <EditorFilterChip
                  key={value}
                  active={sort === value}
                  onClick={() => update("sort", value === "date" ? "" : value)}
                >
                  {t(labelKey)}
                </EditorFilterChip>
              ))}
            </EditorFilterGroup>

            <EditorFilterGroup label={t("blog.hull")}>
              {["268", "269", "270"].map((h) => (
                <EditorFilterChip
                  key={h}
                  active={searchParams.get("hull") === h}
                  onClick={() =>
                    update("hull", searchParams.get("hull") === h ? "" : h)
                  }
                >
                  #{h}
                </EditorFilterChip>
              ))}
            </EditorFilterGroup>

            {options.themes.length > 0 && (
              <EditorFilterGroup label={t("blog.theme")}>
                {options.themes.map((theme) => (
                  <EditorFilterChip
                    key={theme.slug}
                    active={searchParams.get("theme") === theme.slug}
                    onClick={() =>
                      update(
                        "theme",
                        searchParams.get("theme") === theme.slug
                          ? ""
                          : theme.slug
                      )
                    }
                  >
                    {locale === "fr" ? theme.labelFr : theme.labelEn}
                  </EditorFilterChip>
                ))}
              </EditorFilterGroup>
            )}

            {options.tags.length > 0 && (
              <EditorFilterGroup label={t("blog.tag")}>
                {options.tags.map((tag) => (
                  <EditorFilterChip
                    key={tag.name}
                    active={searchParams.get("tag") === tag.name}
                    onClick={() =>
                      update(
                        "tag",
                        searchParams.get("tag") === tag.name ? "" : tag.name
                      )
                    }
                  >
                    {locale === "fr" ? tag.labelFr : tag.labelEn}
                  </EditorFilterChip>
                ))}
              </EditorFilterGroup>
            )}

            {options.milestones.length > 0 && (
              <EditorFilterGroup label={t("gallery.milestone")}>
                {options.milestones.map((m) => (
                  <EditorFilterChip
                    key={m.slug}
                    active={searchParams.get("milestone") === m.slug}
                    onClick={() =>
                      update(
                        "milestone",
                        searchParams.get("milestone") === m.slug ? "" : m.slug
                      )
                    }
                  >
                    {locale === "fr" ? m.titleFr : m.titleEn}
                  </EditorFilterChip>
                ))}
              </EditorFilterGroup>
            )}
          </>
        }
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#495867]">
          {t("gallery.count").replace("{n}", String(photos.length))}
        </p>
        {photos.length > 0 && (
          <button
            type="button"
            onClick={() => slideshow.startSlideshow(0)}
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
                onClick={() => slideshow.openViewer(i)}
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

      <MediaSlideshow
        items={photos}
        open={slideshow.open}
        initialIndex={slideshow.initialIndex}
        initialAutoPlay={slideshow.initialAutoPlay}
        onClose={slideshow.close}
        footer={(item) => {
          const photo = item as GalleryPhoto;
          if (!photo.post?.slug) return null;
          return (
            <div className="mt-3 text-center text-sm text-white/90">
              <Link
                href={`/blog/${photo.post.slug}`}
                className="underline hover:text-white"
              >
                {locale === "fr" ? photo.post.titleFr : photo.post.titleEn}
              </Link>
            </div>
          );
        }}
      />
    </div>
  );
}
