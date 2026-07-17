"use client";

import { ReactNode, useMemo } from "react";
import {
  EditorListToolbar,
  type EditorListActiveChip,
} from "./EditorListToolbar";
import { useLocale } from "./LocaleProvider";

type Props = {
  value: string;
  placeholder: string;
  /** @deprecated use default list.search — kept for call-site compat */
  submitLabel?: string;
  onSubmit: (q: string) => void;
  activeChips?: EditorListActiveChip[];
  onRemoveChip?: (key: string) => void;
  onClearAll?: () => void;
  filterPanel?: ReactNode;
  filtersOpen?: boolean;
  onFiltersOpenChange?: (open: boolean) => void;
  activeFilterCount?: number;
};

/** Thin wrapper — prefer `EditorListToolbar` for new lists with filters. */
export function EditorListSearch({
  value,
  placeholder,
  submitLabel,
  onSubmit,
  activeChips,
  onRemoveChip,
  onClearAll,
  filterPanel,
  filtersOpen,
  onFiltersOpenChange,
  activeFilterCount,
}: Props) {
  const { t } = useLocale();

  const chips = useMemo((): EditorListActiveChip[] => {
    if (activeChips) return activeChips;
    const q = value.trim();
    if (!q) return [];
    return [
      {
        key: "q",
        prefix: t("editor.filters.search"),
        label: q,
      },
    ];
  }, [activeChips, t, value]);

  return (
    <EditorListToolbar
      searchValue={value}
      searchPlaceholder={placeholder}
      searchSubmitLabel={submitLabel ?? t("list.search")}
      onSearchSubmit={onSubmit}
      activeChips={chips}
      onRemoveChip={(key) => {
        if (onRemoveChip) onRemoveChip(key);
        else if (key === "q") onSubmit("");
      }}
      onClearAll={
        onClearAll ??
        (chips.length > 1
          ? () => onSubmit("")
          : chips.length === 1 && chips[0]?.key === "q"
            ? () => onSubmit("")
            : undefined)
      }
      filterPanel={filterPanel}
      filtersOpen={filtersOpen}
      onFiltersOpenChange={onFiltersOpenChange}
      activeFilterCount={activeFilterCount}
    />
  );
}
