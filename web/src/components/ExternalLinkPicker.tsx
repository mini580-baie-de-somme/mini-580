"use client";

import { useCallback, useEffect, useState } from "react";
import { FullscreenEditorModal } from "./FullscreenEditorModal";
import { useLocale } from "./LocaleProvider";

export type ExternalLinkPickerItem = {
  id: string;
  labelFr: string;
  labelEn: string;
  url: string | null;
  urlFr: string | null;
  urlEn: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (linkId: string) => void;
};

function displayUrl(item: ExternalLinkPickerItem): string {
  return item.url?.trim() || item.urlFr?.trim() || item.urlEn?.trim() || "";
}

export function ExternalLinkPicker({ open, onClose, onSelect }: Props) {
  const { locale, t } = useLocale();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<ExternalLinkPickerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(
    async (search: string) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ paginated: "1", limit: "50", offset: "0" });
        if (search.trim()) params.set("q", search.trim());
        const res = await fetch(`/api/external-links?${params}`);
        if (!res.ok) throw new Error(t("externalLinks.loadError"));
        const data = (await res.json()) as { items: ExternalLinkPickerItem[] };
        setItems(data.items ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("externalLinks.loadError"));
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    if (!open) return;
    setQ("");
    void loadItems("");
  }, [open, loadItems]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => void loadItems(q), 250);
    return () => clearTimeout(timer);
  }, [open, q, loadItems]);

  if (!open) return null;

  return (
    <FullscreenEditorModal title={t("externalLinks.insertTitle")} onClose={onClose}>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("externalLinks.search")}
          className="w-full rounded-md border border-[#d4dde6] px-3 py-2 text-sm"
          autoFocus
        />

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-[#d4dde6]">
          {loading ? (
            <p className="px-4 py-6 text-sm text-[#495867]">{t("editor.loading")}</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-[#495867]">{t("externalLinks.emptyPicker")}</p>
          ) : (
            <ul className="divide-y divide-[#d4dde6]">
              {items.map((item) => {
                const label =
                  (locale === "fr" ? item.labelFr : item.labelEn) ||
                  item.labelFr ||
                  item.labelEn;
                const url = displayUrl(item);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(item.id);
                        onClose();
                      }}
                      className="flex w-full flex-col gap-0.5 px-4 py-3 text-left text-sm hover:bg-[#f4f7fa] sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="min-w-0 truncate font-medium text-[#0D131A]">
                        🔗 {label}
                      </span>
                      {url ? (
                        <span className="truncate text-xs text-[#495867] sm:max-w-[40%]">
                          {url}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </FullscreenEditorModal>
  );
}
