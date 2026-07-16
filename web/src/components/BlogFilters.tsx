"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useState } from "react";
import { useLocale } from "./LocaleProvider";

type FilterOptions = {
  themes: { slug: string; labelFr: string; labelEn: string }[];
  tags: { name: string; labelFr: string; labelEn: string }[];
};

export function BlogFilters({ options }: { options: FilterOptions }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const { locale, t } = useLocale();

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      router.push(`/blog?${params.toString()}`);
    },
    [router, searchParams]
  );

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    update("search", search.trim());
  }

  return (
    <div className="rounded-lg border border-[#d4dde6] bg-white/80 p-4 backdrop-blur-sm">
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("blog.search")}
          className="flex-1 rounded-md border border-[#d4dde6] px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-[#495867] px-4 py-2 text-sm text-white hover:bg-[#3a4654]"
        >
          {t("blog.filter")}
        </button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
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
          <span className="text-xs font-medium uppercase tracking-wide text-[#495867]">
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
  );
}
