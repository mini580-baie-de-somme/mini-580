"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  variant?: "default" | "danger";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Centered confirmation dialog — portaled above editor modals. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = "danger",
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted, open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel, open]);

  if (!mounted || !open) return null;

  const confirmClass =
    variant === "danger"
      ? "rounded-md border border-red-300 bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
      : "rounded-md border border-[#495867] bg-[#495867] px-4 py-2 text-sm font-medium text-white hover:bg-[#3d4a57] disabled:opacity-50";

  const node = (
    <>
      <button
        type="button"
        aria-label={cancelLabel}
        className="fixed inset-0 z-[250] bg-[#0D131A]/50"
        disabled={busy}
        onClick={onCancel}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="fixed inset-x-4 top-1/2 z-[251] mx-auto max-w-md -translate-y-1/2 rounded-lg border border-[#d4dde6] bg-white p-5 shadow-xl sm:inset-x-auto sm:w-full"
      >
        <h2
          id="confirm-dialog-title"
          className="text-base font-semibold text-[#0D131A]"
        >
          {title}
        </h2>
        <p id="confirm-dialog-message" className="mt-2 text-sm text-[#495867]">
          {message}
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-[#d4dde6] px-4 py-2 text-sm font-medium text-[#495867] hover:bg-[#f4f7fa] disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={confirmClass}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );

  return createPortal(node, document.body);
}
