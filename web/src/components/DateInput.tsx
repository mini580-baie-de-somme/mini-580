"use client";

import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import {
  applyDateDigitMask,
  isoDateToDisplay,
  parseDisplayDate,
} from "@/lib/date-input-mask";

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

/** Date field: digit mask (JJ.MM.AAAA), ISO keyboard, and native calendar picker. */
export function DateInput({
  value,
  onChange,
  className = "",
  ...rest
}: Props) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => isoDateToDisplay(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(isoDateToDisplay(value));
  }, [value, focused]);

  function commitText(next: string) {
    setText(next);
    const iso = parseDisplayDate(next);
    if (iso) onChange(iso);
  }

  function openPicker() {
    const el = pickerRef.current;
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
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="JJ.MM.AAAA"
        value={text}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          const iso = parseDisplayDate(text);
          if (iso) setText(isoDateToDisplay(iso));
        }}
        onChange={(e) => commitText(applyDateDigitMask(e.target.value))}
        className="datetime-local-input w-full rounded-md border border-[#d4dde6] px-3 py-2 pr-9 text-sm"
        {...rest}
      />
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setText(isoDateToDisplay(e.target.value));
        }}
        className="pointer-events-none absolute h-0 w-0 opacity-0"
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
