"use client";

import { useCallback, useEffect, useState } from "react";
import { FullscreenEditorModal } from "./FullscreenEditorModal";
import { useLocale } from "./LocaleProvider";

export type MediaGroupPickerItem = {
  id: string;
  slug: string;
  titleFr: string;
  titleEn: string;
  memberCount: number;
  layout: "GRID" | "ROW" | "SINGLE";
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (groupId: string) => void;
};

export function MediaGroupPicker({ open, onClose, onSelect }: Props) {
  const { locale, t } = useLocale();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<MediaGroupPickerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(async (search: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ paginated: "1", limit: "50", offset: "0" });
      if (search.trim()) params.set("q", search.trim());
      const res = await fetch(`/api/media-groups?${params}`);
      if (!res.ok) throw new Error(t("mediaGroup.loadError"));
      const data = (await res.json()) as { items: MediaGroupPickerItem[] };
      setItems(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("mediaGroup.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

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

  async function createGroup() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/media-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleFr: "", titleEn: "" }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        throw new Error(
          typeof data.error === "string" ? data.error : t("mediaGroup.saveError")
        );
      }
      onSelect(data.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("mediaGroup.saveError"));
    } finally {
      setCreating(false);
    }
  }

  if (!open) return null;

  return (
    <FullscreenEditorModal
      title={t("mediaGroup.insertTitle")}
      onClose={onClose}
      busy={creating}
      error={error}
      footerLeft={
        <button
          type="button"
          disabled={creating}
          onClick={() => void createGroup()}
          className="rounded-md border border-[#495867] bg-white px-4 py-2 text-sm text-[#495867] hover:bg-[#eef3f7] disabled:opacity-50"
        >
          {t("mediaGroup.new")}
        </button>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("mediaGroup.searchGroups")}
          className="w-full rounded-md border border-[#d4dde6] px-3 py-2 text-sm"
          autoFocus
        />

        <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-[#d4dde6]">
          {loading ? (
            <p className="px-4 py-6 text-sm text-[#495867]">{t("editor.loading")}</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-[#495867]">{t("mediaGroup.emptyPicker")}</p>
          ) : (
            <ul className="divide-y divide-[#d4dde6]">
              {items.map((item) => {
                const title =
                  (locale === "fr" ? item.titleFr : item.titleEn) ||
                  item.slug ||
                  item.id.slice(0, 8);
                const countLabel =
                  locale === "fr"
                    ? `${item.memberCount} média${item.memberCount !== 1 ? "s" : ""}`
                    : `${item.memberCount} media item${item.memberCount !== 1 ? "s" : ""}`;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(item.id);
                        onClose();
                      }}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-[#f4f7fa]"
                    >
                      <span className="min-w-0 truncate font-medium text-[#0D131A]">
                        📷 {title}
                      </span>
                      <span className="shrink-0 text-xs text-[#495867]">{countLabel}</span>
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
