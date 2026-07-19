"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  title: string;
  onClose: () => void;
  busy?: boolean;
  error?: string | null;
  footerLeft?: ReactNode;
  footerRight?: ReactNode;
  children: ReactNode;
};

/** Full-viewport editor dialog — portaled to body to escape page stacking contexts. */
export function FullscreenEditorModal({
  title,
  onClose,
  busy,
  error,
  footerLeft,
  footerRight,
  children,
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const node = (
    <div
      className="fixed inset-0 z-[200] flex items-stretch justify-stretch bg-[#0D131A]/60 p-0 sm:p-2 lg:p-3"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="flex h-full max-h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:max-h-[calc(100dvh-1rem)] sm:rounded-xl lg:max-h-[calc(100dvh-1.5rem)]">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#d4dde6] px-3 py-2.5 sm:px-4">
          <h2 className="truncate text-base font-semibold text-[#0D131A]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="shrink-0 rounded border border-[#d4dde6] px-3 py-1 text-sm text-[#495867] hover:bg-[#eef3f7] disabled:opacity-50"
          >
            ×
          </button>
        </header>

        {error && (
          <p className="shrink-0 border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#d4dde6] bg-[#fafbfc] px-3 py-2.5 sm:px-4">
          <div className="flex flex-wrap gap-2">{footerLeft}</div>
          <div className="ml-auto flex flex-wrap gap-2">{footerRight}</div>
        </footer>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(node, document.body);
}
