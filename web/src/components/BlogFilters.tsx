"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useState } from "react";

type FilterOptions = {
  themes: { slug: string; labelFr: string }[];
  tags: { name: string; labelFr: string }[];
};

export function BlogFilters({ options }: { options: FilterOptions }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");

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
          placeholder="Rechercher…"
          className="flex-1 rounded-md border border-[#d4dde6] px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-[#495867] px-4 py-2 text-sm text-white hover:bg-[#3a4654]"
        >
          Filtrer
        </button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-[#495867]">
          Coque:
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
            Thème:
          </span>
          {options.themes.map((t) => (
            <button
              key={t.slug}
              type="button"
              onClick={() =>
                update("theme", searchParams.get("theme") === t.slug ? "" : t.slug)
              }
              className={`rounded border px-2 py-1 text-xs ${
                searchParams.get("theme") === t.slug
                  ? "border-[#495867] bg-[#495867] text-white"
                  : "border-[#d4dde6] bg-white text-[#495867]"
              }`}
            >
              {t.labelFr}
            </button>
          ))}
        </div>
      )}

      {options.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-[#495867]">
            Tag:
          </span>
          {options.tags.map((t) => (
            <button
              key={t.name}
              type="button"
              onClick={() =>
                update("tag", searchParams.get("tag") === t.name ? "" : t.name)
              }
              className={`rounded border px-2 py-1 text-xs ${
                searchParams.get("tag") === t.name
                  ? "border-[#495867] bg-[#495867] text-white"
                  : "border-[#d4dde6] bg-white text-[#495867]"
              }`}
            >
              {t.labelFr}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
