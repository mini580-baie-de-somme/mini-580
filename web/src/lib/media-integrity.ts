import "server-only";

import { MediaKind } from "@/generated/prisma/client";
import { getMediaBucket, mediaKeyFromUrl } from "@/lib/media-bucket";
import type {
  MediaIntegrity,
  MediaIntegrityInput,
  MediaIntegrityIssue,
} from "@/lib/media-integrity-types";

const IMAGE_VARIANT_URLS = [
  "urlPicto",
  "urlPetite",
  "urlMoyenne",
  "urlGrande",
] as const;

function isRemoteUrl(url: string): boolean {
  const t = url.trim();
  return t.startsWith("http://") || t.startsWith("https://");
}

export function isLocalMediaUrl(url: string): boolean {
  const trimmed = url.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return false;
  }
  return mediaKeyFromUrl(trimmed) !== null;
}

async function localFileExists(url: string): Promise<boolean> {
  const key = mediaKeyFromUrl(url);
  if (!key) return false;
  const meta = await getMediaBucket().headObject(key);
  return meta !== null;
}

function issueMessage(issue: MediaIntegrityIssue, url?: string): string {
  switch (issue) {
    case "REMOTE_ORIGIN":
      return `Origin URL is external (not local storage): ${url ?? "?"}`;
    case "ORIGIN_NOT_LOCAL":
      return `Origin is not a local /media/ path: ${url ?? "?"}`;
    case "ORIGIN_MISSING":
      return `Origin file missing from local storage: ${url ?? "?"}`;
    case "VARIANT_NOT_LOCAL":
      return `Variant is not a local /media/ path: ${url ?? "?"}`;
    case "VARIANT_MISSING":
      return `Variant file missing from local storage: ${url ?? "?"}`;
    default:
      return issue;
  }
}

async function checkUrl(
  url: string | null | undefined,
  opts: { required: boolean; remoteIssue: MediaIntegrityIssue; localIssue: MediaIntegrityIssue; missingIssue: MediaIntegrityIssue }
): Promise<MediaIntegrityIssue[]> {
  if (!url) {
    return opts.required ? [opts.missingIssue] : [];
  }
  if (isRemoteUrl(url)) {
    return [opts.remoteIssue];
  }
  if (!isLocalMediaUrl(url)) {
    return [opts.localIssue];
  }
  if (!(await localFileExists(url))) {
    return [opts.missingIssue];
  }
  return [];
}

/** Assess whether media files are present in the local bucket. */
export async function assessMediaIntegrity(
  media: MediaIntegrityInput
): Promise<MediaIntegrity> {
  const issues: MediaIntegrityIssue[] = [];

  const originIssues = await checkUrl(media.urlOrigin, {
    required: true,
    remoteIssue: "REMOTE_ORIGIN",
    localIssue: "ORIGIN_NOT_LOCAL",
    missingIssue: "ORIGIN_MISSING",
  });
  issues.push(...originIssues);

  if (media.kind === MediaKind.IMAGE || media.kind === "IMAGE") {
    for (const key of IMAGE_VARIANT_URLS) {
      const url = media[key];
      if (!url) {
        issues.push("VARIANT_MISSING");
        continue;
      }
      const variantIssues = await checkUrl(url, {
        required: true,
        remoteIssue: "VARIANT_NOT_LOCAL",
        localIssue: "VARIANT_NOT_LOCAL",
        missingIssue: "VARIANT_MISSING",
      });
      issues.push(...variantIssues);
    }
  }

  const uniqueIssues = [...new Set(issues)];
  const originEditable =
    !uniqueIssues.some((i) =>
      ["REMOTE_ORIGIN", "ORIGIN_NOT_LOCAL", "ORIGIN_MISSING"].includes(i)
    );

  return {
    ok: uniqueIssues.length === 0,
    editable: originEditable,
    issues: uniqueIssues,
    messages: uniqueIssues.map((issue) => {
      if (issue === "ORIGIN_MISSING" || issue === "REMOTE_ORIGIN" || issue === "ORIGIN_NOT_LOCAL") {
        return issueMessage(issue, media.urlOrigin);
      }
      return issueMessage(issue);
    }),
  };
}

export async function assertEditableImageOrigin(
  media: MediaIntegrityInput
): Promise<MediaIntegrity> {
  const integrity = await assessMediaIntegrity(media);
  if (!integrity.editable) {
    const err = new Error(
      integrity.messages[0] ??
        "Original image is not available in local media storage. Re-upload the file."
    );
    err.name = "MediaIntegrityError";
    throw err;
  }
  return integrity;
}

export async function enrichMediaWithIntegrity<T extends MediaIntegrityInput>(
  media: T
): Promise<T & { integrity: MediaIntegrity }> {
  const integrity = await assessMediaIntegrity(media);
  return { ...media, integrity };
}

export async function enrichMediaListWithIntegrity<T extends MediaIntegrityInput>(
  items: T[]
): Promise<Array<T & { integrity: MediaIntegrity }>> {
  return Promise.all(items.map((item) => enrichMediaWithIntegrity(item)));
}
