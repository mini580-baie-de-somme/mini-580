"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { countListFilters, isListFiltered } from "@/lib/editor-list";
import { useLocale } from "./LocaleProvider";

type FilterOptions = {
  themes: { slug: string; labelFr: string; labelEn: string }[];
  tags: { name: string; labelFr: string; labelEn: string }[];
};

const STATUS_OPTIONS = ["ALL", "DRAFT", "PUBLISHED", "ARCHIVED"] as const;
const FILTER_KEYS = ["q", "status", "hull", "theme", "tag"];

type ActiveChip = {
  key: string;
  label: string;
  prefix: string;
};

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function EditorPostFilters({ options }: { options: FilterOptions }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale, t } = useLocale();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [open, setOpen] = useState(false);

  const filtered = isListFiltered(searchParams, FILTER_KEYS);
  const activeCount = countListFilters(searchParams, FILTER_KEYS);

  useEffect(() => {
    setSearch(searchParams.get("q") ?? "");
  }, [searchParams]);

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      router.push(`/editeur?${params.toString()}`);
    },
    [router, searchParams]
  );

  const activeChips = useMemo((): ActiveChip[] => {
    const chips: ActiveChip[] = [];
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

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    update("q", search.trim());
  }

  function removeFilter(key: string) {
    if (key === "q") setSearch("");
    update(key, "");
  }

  function clearAll() {
    setSearch("");
    router.push("/editeur");
  }

  const activeStatus = searchParams.get("status") ?? "ALL";

  return (
    <div className="mb-4 overflow-hidden rounded-lg border border-[#d4dde6] bg-white">
      <div className="p-3 sm:p-4">
        <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("editor.search")}
            className="min-w-0 flex-1 rounded-md border border-[#d4dde6] px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm sm:flex-none ${
                open || filtered
                  ? "border-[#495867] bg-[#f4f7fa] text-[#0D131A]"
                  : "border-[#d4dde6] bg-white text-[#495867]"
              }`}
            >
              <span>{t("editor.filters.toggle")}</span>
              {activeCount > 0 && (
                <span className="rounded-full bg-[#495867] px-1.5 py-0.5 text-[10px] font-medium leading-none text-white">
                  {activeCount}
                </span>
              )}
              <ChevronIcon open={open} />
            </button>
            <button
              type="submit"
              className="flex-1 rounded-md bg-[#495867] px-4 py-2 text-sm text-white hover:bg-[#3a4654] sm:flex-none"
            >
              {t("editor.filter")}
            </button>
          </div>
        </form>

        {!open && activeChips.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => removeFilter(chip.key)}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#d4dde6] bg-[#f8fafc] px-2.5 py-1 text-xs text-[#0D131A] hover:bg-[#eef3f7]"
                title={t("editor.filters.remove")}
              >
                <span className="shrink-0 text-[#495867]">{chip.prefix}:</span>
                <span className="truncate">{chip.label}</span>
                <span aria-hidden className="shrink-0 text-[#495867]">
                  ×
                </span>
              </button>
            ))}
            {activeChips.length > 1 && (
              <button
                type="button"
                onClick={clearAll}
                className="text-xs text-[#495867] underline-offset-2 hover:underline"
              >
                {t("editor.filters.clearAll")}
              </button>
            )}
          </div>
        )}
      </div>

      {open && (
        <div className="border-t border-[#d4dde6] px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
          <div className="flex flex-wrap gap-2">
            <span className="w-full text-xs font-medium uppercase tracking-wide text-[#495867] sm:w-auto">
              {t("editor.status")}
            </span>
            {STATUS_OPTIONS.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() =>
                  update("status", activeStatus === status ? "" : status === "ALL" ? "" : status)
                }
                className={`rounded border px-2 py-1 text-xs ${
                  (status === "ALL" && !searchParams.get("status")) ||
                  searchParams.get("status") === status
                    ? "border-[#495867] bg-[#495867] text-white"
                    : "border-[#d4dde6] bg-white text-[#495867]"
                }`}
              >
                {t(`editor.status.${status.toLowerCase()}` as "editor.status.all")}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="w-full text-xs font-medium uppercase tracking-wide text-[#495867] sm:w-auto">
              {t("blog.hull")}
            </span>
            {["268", "269", "270"].map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => update("hull", searchParams.get("hull") === h ? "" : h)}
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
              <span className="w-full text-xs font-medium uppercase tracking-wide text-[#495867] sm:w-auto">
                {t("blog.theme")}
              </span>
              {options.themes.map((theme) => (
                <button
                  key={theme.slug}
                  type="button"
                  onClick={() =>
                    update("theme", searchParams.get("theme") === theme.slug ? "" : theme.slug)
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
              <span className="w-full text-xs font-medium uppercase tracking-wide text-[#495867] sm:w-auto">
                {t("blog.tag")}
              </span>
              {options.tags.map((tag) => (
                <button
                  key={tag.name}
                  type="button"
                  onClick={() =>
                    update("tag", searchParams.get("tag") === tag.name ? "" : tag.name)
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
        </div>
      )}
    </div>
  );
}
