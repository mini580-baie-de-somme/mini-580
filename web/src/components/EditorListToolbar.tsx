"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import { useLocale } from "./LocaleProvider";

export type EditorListActiveChip = {
  key: string;
  prefix: string;
  label: string;
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

type Props = {
  searchValue: string;
  searchPlaceholder: string;
  onSearchSubmit: (q: string) => void;
  /** Shown left of the search field — default i18n `list.search` */
  searchSubmitLabel?: string;
  activeChips?: EditorListActiveChip[];
  onRemoveChip?: (key: string) => void;
  onClearAll?: () => void;
  /** When provided, shows Filtres toggle and collapsible panel */
  filterPanel?: ReactNode;
  filtersOpen?: boolean;
  onFiltersOpenChange?: (open: boolean) => void;
  activeFilterCount?: number;
};

/**
 * Standard list toolbar: [Rechercher] [input] [Filtres ▼]
 * Active chips below; filter chip groups in a collapsible panel.
 */
export function EditorListToolbar({
  searchValue,
  searchPlaceholder,
  onSearchSubmit,
  searchSubmitLabel,
  activeChips = [],
  onRemoveChip,
  onClearAll,
  filterPanel,
  filtersOpen,
  onFiltersOpenChange,
  activeFilterCount = 0,
}: Props) {
  const { t } = useLocale();
  const [search, setSearch] = useState(searchValue);
  const [internalOpen, setInternalOpen] = useState(false);
  const hasFilters = filterPanel != null;
  const open = filtersOpen ?? internalOpen;
  const setOpen = onFiltersOpenChange ?? setInternalOpen;

  useEffect(() => {
    setSearch(searchValue);
  }, [searchValue]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSearchSubmit(search.trim());
  }

  const submitLabel = searchSubmitLabel ?? t("list.search");

  return (
    <div className="mb-4 overflow-hidden rounded-lg border border-[#d4dde6] bg-white">
      <div className="p-3 sm:p-4">
        <form
          onSubmit={handleSubmit}
          className="flex flex-wrap items-center gap-2"
        >
          <button
            type="submit"
            className="shrink-0 rounded-md bg-[#495867] px-4 py-2 text-sm text-white hover:bg-[#3a4654]"
          >
            {submitLabel}
          </button>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="min-w-[10rem] flex-1 rounded-md border border-[#d4dde6] px-3 py-2 text-sm"
          />
          {hasFilters && (
            <button
              type="button"
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm ${
                open || activeFilterCount > 0
                  ? "border-[#495867] bg-[#f4f7fa] text-[#0D131A]"
                  : "border-[#d4dde6] bg-white text-[#495867]"
              }`}
            >
              <span>{t("editor.filters.toggle")}</span>
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-[#495867] px-1.5 py-0.5 text-[10px] font-medium leading-none text-white">
                  {activeFilterCount}
                </span>
              )}
              <ChevronIcon open={open} />
            </button>
          )}
        </form>

        {activeChips.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => onRemoveChip?.(chip.key)}
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
            {activeChips.length > 1 && onClearAll && (
              <button
                type="button"
                onClick={onClearAll}
                className="text-xs text-[#495867] underline-offset-2 hover:underline"
              >
                {t("editor.filters.clearAll")}
              </button>
            )}
          </div>
        )}
      </div>

      {hasFilters && open && (
        <div className="border-t border-[#d4dde6] px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
          {filterPanel}
        </div>
      )}
    </div>
  );
}

/** Shared chip button style for groups inside the filters panel. */
export function EditorFilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded border px-2 py-1 text-xs ${
        active
          ? "border-[#495867] bg-[#495867] text-white"
          : "border-[#d4dde6] bg-white text-[#495867]"
      }`}
    >
      {children}
    </button>
  );
}

export function EditorFilterGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2 first:mt-0">
      <span className="w-full text-xs font-medium uppercase tracking-wide text-[#495867] sm:w-auto">
        {label}
      </span>
      {children}
    </div>
  );
}
