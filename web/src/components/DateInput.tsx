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

/** date input with native chevron hidden, calendar icon, and keyboard entry. */
export function DateInput({
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
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="datetime-local-input w-full rounded-md border border-[#d4dde6] px-3 py-2 pr-9 text-sm"
        {...rest}
      />
      <button
        type="button"
        aria-label="Choisir une date"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-[#495867] active:bg-[#eef3f7]"
        onClick={openPicker}
      >
        <CalendarIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
