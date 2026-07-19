"use client";

import { useState } from "react";
import {
  pasteImageFromClipboard,
  type ClipboardPasteError,
} from "@/lib/media-file-client";

type Props = {
  disabled?: boolean;
  label: string;
  onFile: (file: File) => void;
  onError: (message: string) => void;
  errorMessage: (error: ClipboardPasteError) => string;
  className?: string;
};

export function MediaClipboardPasteButton({
  disabled = false,
  label,
  onFile,
  onError,
  errorMessage,
  className = "",
}: Props) {
  const [pasting, setPasting] = useState(false);

  async function handlePaste() {
    setPasting(true);
    try {
      const result = await pasteImageFromClipboard();
      if (result.ok) {
        onFile(result.file);
        return;
      }
      onError(errorMessage(result.error));
    } finally {
      setPasting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handlePaste()}
      disabled={disabled || pasting}
      className={
        className ||
        "min-h-[44px] flex-1 rounded border border-[#d4dde6] px-3 py-1.5 text-sm text-[#495867] hover:bg-[#eef3f7] disabled:opacity-50"
      }
    >
      {label}
    </button>
  );
}
