"use client";

import { useRef, type InputHTMLAttributes } from "react";

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange"
> & {
  value: string;
  onChange: (value: string) => void;
};

/** datetime-local with native chevron hidden and a calendar icon on the right. */
export function DatetimeLocalInput({
  value,
  onChange,
  className = "",
  ...rest
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    const el = inputRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") {
      el.showPicker();
    } else {
      el.focus();
    }
  }

  return (
    <div className={`relative mt-0.5 ${className}`}>
      <input
        ref={inputRef}
        type="datetime-local"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="datetime-local-input w-full rounded border border-[#d4dde6] px-2 py-1 pr-9 text-sm"
        {...rest}
      />
      <button
        type="button"
        aria-label="Choisir date et heure"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-[#495867] active:bg-[#eef3f7]"
        onClick={openPicker}
      >
        <CalendarIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
