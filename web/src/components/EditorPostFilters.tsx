"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { countListFilters } from "@/lib/editor-list";
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
};

const STATUS_OPTIONS = ["ALL", "DRAFT", "PUBLISHED", "ARCHIVED"] as const;
const FILTER_KEYS = ["q", "status", "hull", "theme", "tag"];

export function EditorPostFilters({ options }: { options: FilterOptions }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale, t } = useLocale();
  const [open, setOpen] = useState(false);

  const activeCount = countListFilters(searchParams, FILTER_KEYS);

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      router.push(`/editeur?${params.toString()}`);
    },
    [router, searchParams]
  );

  const activeChips = useMemo((): EditorListActiveChip[] => {
    const chips: EditorListActiveChip[] = [];
    const q = searchParams.get("q")?.trim();
    if (q) {
      chips.push({
        key: "q",
        prefix: t("editor.filters.search"),
        label: q,
      });
    }

    const status = searchParams.get("status");
    if (status && status !== "ALL") {
      chips.push({
        key: "status",
        prefix: t("editor.status").replace(":", ""),
        label: t(`editor.status.${status.toLowerCase()}` as "editor.status.draft"),
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

    return chips;
  }, [locale, options.tags, options.themes, searchParams, t]);

  function removeFilter(key: string) {
    update(key, "");
  }

  function clearAll() {
    router.push("/editeur");
  }

  const activeStatus = searchParams.get("status") ?? "ALL";

  return (
    <EditorListToolbar
      searchValue={searchParams.get("q") ?? ""}
      searchPlaceholder={t("editor.search")}
      onSearchSubmit={(q) => update("q", q)}
      activeChips={activeChips}
      onRemoveChip={removeFilter}
      onClearAll={clearAll}
      filtersOpen={open}
      onFiltersOpenChange={setOpen}
      activeFilterCount={activeCount}
      filterPanel={
        <>
          <EditorFilterGroup label={t("editor.status")}>
            {STATUS_OPTIONS.map((status) => (
              <EditorFilterChip
                key={status}
                active={
                  (status === "ALL" && !searchParams.get("status")) ||
                  searchParams.get("status") === status
                }
                onClick={() =>
                  update(
                    "status",
                    activeStatus === status ? "" : status === "ALL" ? "" : status
                  )
                }
              >
                {t(`editor.status.${status.toLowerCase()}` as "editor.status.all")}
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
                      searchParams.get("theme") === theme.slug ? "" : theme.slug
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
        </>
      }
    />
  );
}
