"use client";

import { FormEvent, useEffect, useState } from "react";

type Props = {
  value: string;
  placeholder: string;
  submitLabel: string;
  onSubmit: (q: string) => void;
};

export function EditorListSearch({ value, placeholder, submitLabel, onSubmit }: Props) {
  const [search, setSearch] = useState(value);

  useEffect(() => {
    setSearch(value);
  }, [value]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(search.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 flex flex-col gap-3 sm:flex-row">
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={placeholder}
        className="flex-1 rounded-md border border-[#d4dde6] bg-white px-3 py-2 text-sm"
      />
      <button
        type="submit"
        className="rounded-md bg-[#495867] px-4 py-2 text-sm text-white hover:bg-[#3a4654]"
      >
        {submitLabel}
      </button>
    </form>
  );
}
