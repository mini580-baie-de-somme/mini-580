/** Unified API error parsing and user-facing save error messages (post editor + library). */

import { isNetworkFetchError } from "@/lib/fetch-with-network-retry";
import { isLocalMediaUrl } from "@/lib/media-integrity-shared";

export type MediaApiErrorBody = {
  error?: unknown;
  traceId?: string;
  detail?: string;
  step?: string;
  kind?: string;
  id?: string;
  urlOrigin?: string;
  [k: string]: unknown;
};

/** Parse JSON (or plain-text) error bodies from media upload/patch endpoints. */
export async function readMediaApiError(res: Response): Promise<MediaApiErrorBody> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as MediaApiErrorBody;
  } catch {
    if (res.status === 413) {
      return { error: "PAYLOAD_TOO_LARGE" };
    }
    return { error: `HTTP ${res.status}` };
  }
}

/** @deprecated Use readMediaApiError — kept for photo-editor trace call sites. */
export const readApiErrorBody = readMediaApiError;

export function errorMessageFromApiBody(
  body: MediaApiErrorBody,
  fallback: string
): string {
  if (typeof body.detail === "string" && body.detail) return body.detail;
  if (typeof body.error === "string" && body.error) return body.error;
  return fallback;
}

export function formatMediaSaveError(
  err: unknown,
  locale: "fr" | "en",
  phase: "upload" | "patch"
): string {
  if (isNetworkFetchError(err)) {
    if (phase === "upload") {
      return locale === "fr"
        ? "Envoi du fichier interrompu — réessaie (photo plus légère si ça persiste)."
        : "File upload interrupted — try again (use a smaller photo if it persists).";
    }
    return locale === "fr"
      ? "Enregistrement interrompu — réessaie dans quelques secondes."
      : "Save interrupted — try again in a few seconds.";
  }
  if (err instanceof Error) return err.message;
  return locale === "fr" ? "Échec de l'enregistrement" : "Save failed";
}

/** Prefix generic failures for modal display (both editors). */
export function wrapMediaSaveErrorMessage(
  message: string,
  locale: "fr" | "en"
): string {
  if (locale === "fr") {
    if (
      message.startsWith("Échec") ||
      message.includes("interrompu") ||
      message.includes("Envoi")
    ) {
      return message;
    }
    return `Échec de l'enregistrement — ${message}`;
  }
  if (
    message.startsWith("Save failed") ||
    message.includes("interrupted") ||
    message.includes("upload")
  ) {
    return message;
  }
  return `Save failed — ${message}`;
}

export class MediaSaveFlowError extends Error {
  phase: "upload" | "patch";
  constructor(message: string, phase: "upload" | "patch") {
    super(message);
    this.name = "MediaSaveFlowError";
    this.phase = phase;
  }
}

export function assertLocalOriginUrl(
  urlOrigin: string | null | undefined,
  locale: "fr" | "en"
): void {
  if (!urlOrigin || !isLocalMediaUrl(urlOrigin)) {
    throw new MediaSaveFlowError(
      locale === "fr"
        ? "Le fichier n'a pas été enregistré dans le stockage local /media."
        : "File was not saved to local /media storage.",
      "upload"
    );
  }
}
