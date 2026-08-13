"use client";

import { useCallback, useEffect, useState } from "react";
import {
  isAllowedMediaFile,
  kindFromFile,
  mediaFileFromDataTransfer,
  resolveFileMime,
  type MediaKindClient,
} from "@/lib/media-file-client";
import { formatMaxMb, maxBytesForMime } from "@/lib/media-limits";
import { prepareImageForUpload } from "@/lib/prepare-upload-image";

export type MediaFileValidationMessages = {
  coverMustBePhoto?: string;
  fileInvalid: string;
  fileTooLarge: string;
  fileTooLargeVideo: string;
};

export type ValidateMediaFileOptions = {
  imagesOnly?: boolean;
  messages: MediaFileValidationMessages;
};

/** Shared drag/drop/paste file validation (locale-specific messages via caller). */
export function validateMediaFile(
  file: File,
  opts: ValidateMediaFileOptions
): string | null {
  if (opts.imagesOnly) {
    if (!file.type.startsWith("image/")) {
      return (
        opts.messages.coverMustBePhoto ??
        "Cover must be a photo."
      );
    }
  } else if (!isAllowedMediaFile(file)) {
    return opts.messages.fileInvalid;
  }

  const mime = resolveFileMime(file) ?? file.type;
  const max = maxBytesForMime(mime);
  if (file.size > max) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    const maxMb = String(formatMaxMb(max));
    const isVideo = mime.toLowerCase().startsWith("video/");
    return (isVideo ? opts.messages.fileTooLargeVideo : opts.messages.fileTooLarge)
      .replace("{size}", sizeMb)
      .replace("{max}", maxMb);
  }

  return null;
}

export type UseMediaFileQueueOptions = {
  imagesOnly?: boolean;
  busy?: boolean;
  enabled?: boolean;
  messages: MediaFileValidationMessages;
  onError: (message: string) => void;
  /** Called with prepared file after validation (image may be re-encoded). */
  onAccepted: (file: File, kind: MediaKindClient) => void;
};

/** Pending file + preview URL + shared validation for media editor modals. */
export function useMediaFileQueue(opts: UseMediaFileQueueOptions) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const acceptFile = useCallback(
    (next: File | null) => {
      if (!next) {
        setFile(null);
        return;
      }
      const err = validateMediaFile(next, {
        imagesOnly: opts.imagesOnly,
        messages: opts.messages,
      });
      if (err) {
        opts.onError(err);
        return;
      }
      void (async () => {
        const kind = kindFromFile(next) ?? "IMAGE";
        const prepared =
          kind === "IMAGE" ? await prepareImageForUpload(next) : next;
        setFile(prepared);
        opts.onAccepted(prepared, kind);
      })();
    },
    [opts.imagesOnly, opts.messages, opts.onError, opts.onAccepted]
  );

  useEffect(() => {
    if (opts.enabled === false) return;
    function onPaste(e: ClipboardEvent) {
      if (opts.busy) return;
      const next = opts.imagesOnly
        ? (() => {
            const data = e.clipboardData;
            if (!data) return null;
            for (const item of data.items) {
              if (item.type.startsWith("image/")) {
                const f = item.getAsFile();
                if (f) return f;
              }
            }
            return null;
          })()
        : mediaFileFromDataTransfer(e.clipboardData);
      if (!next) return;
      e.preventDefault();
      acceptFile(next);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [opts.busy, opts.enabled, opts.imagesOnly, acceptFile]);

  return {
    file,
    setFile,
    previewUrl,
    acceptFile,
    clearFile: () => setFile(null),
  };
}
