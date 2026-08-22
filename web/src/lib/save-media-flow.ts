/**
 * Unified save orchestration for post gallery/cover editor and media library.
 *
 * Intentional asymmetries (strategy-specific):
 * - post: PATCH `/api/posts/:postId/images/:id` always includes layout when editable;
 *   library: layout in PATCH only when file replaced or layout changed.
 * - post: rebake follow-up refreshes gallery via onSaved + fetchMediaAfterRebakeTimeout;
 *   library: rebake poll reloads list when variant URLs rotate (or on timeout).
 * - post: replace/upload FormData includes metadata; library replace is file-only.
 * - library create: separate layout PATCH after upload for IMAGE; post merges in one PATCH.
 */

import {
  mediaVariantSnapshot,
  mergeEditorImageLayout,
  toEditorImage,
  type GalleryEditorImage,
  type MediaVariantSnapshot,
} from "@/lib/gallery-editor";
import { fetchWithNetworkRetry } from "@/lib/fetch-with-network-retry";
import type { ImageLayoutParams } from "@/lib/image-layout";
import type { MediaKindClient } from "@/lib/media-file-client";
import {
  assertLocalOriginUrl,
  errorMessageFromApiBody,
  MediaSaveFlowError,
  readMediaApiError,
} from "@/lib/media-save-errors";
import {
  photoEditorTrace,
  type PhotoEditorTraceContext,
} from "@/lib/media-trace-client";
import { prepareImageForUpload } from "@/lib/prepare-upload-image";
import { uploadFormDataWithRetry } from "@/lib/upload-form-data";
import {
  fetchMediaAfterRebakeTimeout,
  mediaVariantsChanged,
  waitForMediaRebakeAfterPatch,
} from "@/lib/wait-for-media-rebake";

export type MediaSaveMetadata = {
  titleFr: string;
  titleEn: string;
  descriptionFr: string;
  descriptionEn: string;
  takenAt: string | Date | null;
};

export type SaveMediaFlowPhase = "upload" | "patch";

export type PostSaveMediaInput = {
  strategy: "post";
  postId: string;
  /** Current editor draft (may lack id on create). */
  draft: GalleryEditorImage | null;
  pendingFile: File | null;
  effectiveKind: MediaKindClient;
  metadata: MediaSaveMetadata;
  layout: ImageLayoutParams;
  cropAspectFormat?: string;
  canEditImageLayout: boolean;
  locale: "fr" | "en";
  trace: PhotoEditorTraceContext;
};

export type LibrarySaveMediaMessages = {
  saveError: string;
  uploadRejected: string;
  localStorageRequired: string;
  fileRequired: string;
};

export type LibrarySaveMediaInput = {
  strategy: "library";
  mode: "create" | "edit";
  mediaId?: string;
  pendingFile: File | null;
  effectiveKind: MediaKindClient | null;
  metadata: MediaSaveMetadata;
  layout: ImageLayoutParams;
  cropAspectFormat?: string;
  originEditable: boolean;
  layoutChanged: boolean;
  locale: "fr" | "en";
  messages: LibrarySaveMediaMessages;
  /** Substitute {photoMax} and {videoMax} in uploadRejected message. */
  formatUploadRejected?: (template: string) => string;
};

export type SaveMediaFlowInput = PostSaveMediaInput | LibrarySaveMediaInput;

export type SaveMediaFlowResult = {
  saved: GalleryEditorImage;
  layoutPatched: boolean;
  patchVariantBaseline: MediaVariantSnapshot | null;
  lastPhase: SaveMediaFlowPhase;
  rebakePending?: boolean;
};

function takenAtIso(takenAt: string | Date | null): string | null {
  if (!takenAt) return null;
  return typeof takenAt === "string" ? takenAt : takenAt.toISOString();
}

function buildMetadataFormFields(metadata: MediaSaveMetadata, fd: FormData): void {
  fd.set("titleFr", metadata.titleFr);
  fd.set("titleEn", metadata.titleEn);
  fd.set("descriptionFr", metadata.descriptionFr);
  fd.set("descriptionEn", metadata.descriptionEn);
  const iso = takenAtIso(metadata.takenAt);
  if (iso) fd.set("takenAt", iso);
}

function metadataPatchBody(metadata: MediaSaveMetadata): Record<string, unknown> {
  return {
    titleFr: metadata.titleFr,
    titleEn: metadata.titleEn,
    descriptionFr: metadata.descriptionFr,
    descriptionEn: metadata.descriptionEn,
    takenAt: takenAtIso(metadata.takenAt),
  };
}

async function prepareUploadFile(
  file: File,
  kind: MediaKindClient | null
): Promise<File> {
  return kind === "IMAGE" ? prepareImageForUpload(file) : file;
}

function libraryUploadRejectedMessage(
  input: LibrarySaveMediaInput,
  res: Response,
  body: Awaited<ReturnType<typeof readMediaApiError>>
): string {
  if (body.error === "PAYLOAD_TOO_LARGE" || res.status === 413) {
    const template = input.messages.uploadRejected;
    return input.formatUploadRejected?.(template) ?? template;
  }
  return errorMessageFromApiBody(body, input.messages.saveError);
}

async function uploadPostMedia(
  input: PostSaveMediaInput,
  current: GalleryEditorImage,
  uploadFile: File,
  trace: PhotoEditorTraceContext
): Promise<GalleryEditorImage> {
  const buildUploadBody = () => {
    const body = new FormData();
    body.append("file", uploadFile);
    buildMetadataFormFields(input.metadata, body);
    return body;
  };

  if (current.id) {
    photoEditorTrace(trace, "save.replace.start", {
      mediaId: current.id,
      bytes: uploadFile.size,
    }, "info");
    const rep = await uploadFormDataWithRetry(
      `/api/media-library/${current.id}/replace`,
      buildUploadBody
    );
    if (!rep.ok) {
      const errBody = await readMediaApiError(rep);
      photoEditorTrace(trace, "save.replace.failed", {
        status: rep.status,
        ...errBody,
      }, "error");
      throw new MediaSaveFlowError(
        errorMessageFromApiBody(errBody, "replace failed"),
        "upload"
      );
    }
    const next = toEditorImage(await rep.json());
    assertLocalOriginUrl(next.urlOrigin, input.locale);
    photoEditorTrace(trace, "save.replace.done", { mediaId: next.id }, "info");
    return next;
  }

  photoEditorTrace(trace, "save.upload.start", {
    postId: input.postId,
    bytes: uploadFile.size,
    mime: uploadFile.type,
  }, "info");
  const res = await uploadFormDataWithRetry(
    `/api/posts/${input.postId}/media`,
    buildUploadBody
  );
  if (!res.ok) {
    const errBody = await readMediaApiError(res);
    photoEditorTrace(trace, "save.upload.failed", {
      status: res.status,
      ...errBody,
    }, "error");
    throw new MediaSaveFlowError(
      errorMessageFromApiBody(errBody, "upload failed"),
      "upload"
    );
  }
  const next = toEditorImage(await res.json());
  assertLocalOriginUrl(next.urlOrigin, input.locale);
  photoEditorTrace(trace, "save.upload.done", { mediaId: next.id }, "info");
  return next;
}

async function savePostMedia(input: PostSaveMediaInput): Promise<SaveMediaFlowResult> {
  const trace = input.trace;
  let lastPhase: SaveMediaFlowPhase = "patch";
  const isImage = input.effectiveKind === "IMAGE";
  const layoutWillPatch = isImage && input.canEditImageLayout;

  photoEditorTrace(trace, "save.start", {
    hasPendingFile: Boolean(input.pendingFile),
    isImage,
    layout: isImage ? input.layout : undefined,
  }, "info");

  let current: GalleryEditorImage = input.draft
    ? { ...input.draft }
    : toEditorImage({ ...input.metadata, id: "", kind: input.effectiveKind });

  if (input.pendingFile) {
    lastPhase = "upload";
    photoEditorTrace(trace, "save.prepare.start", {
      bytes: input.pendingFile.size,
      mime: input.pendingFile.type,
      name: input.pendingFile.name,
    }, "info");
    const prepareStarted = Date.now();
    const uploadFile = await prepareUploadFile(
      input.pendingFile,
      input.effectiveKind
    );
    photoEditorTrace(trace, "save.prepare.done", {
      bytesIn: input.pendingFile.size,
      bytesOut: uploadFile.size,
      mime: uploadFile.type,
      ms: Date.now() - prepareStarted,
    }, "info");

    current = await uploadPostMedia(input, current, uploadFile, trace);

    if (input.draft) {
      current = {
        ...current,
        titleFr: input.draft.titleFr,
        titleEn: input.draft.titleEn,
        descriptionFr: input.draft.descriptionFr,
        descriptionEn: input.draft.descriptionEn,
        takenAt: input.draft.takenAt,
      };
    }
  }

  if (!current.id) throw new MediaSaveFlowError("missing id", "patch");
  trace.mediaId = current.id;

  const patchBody: Record<string, unknown> = metadataPatchBody({
    titleFr: current.titleFr,
    titleEn: current.titleEn,
    descriptionFr: current.descriptionFr,
    descriptionEn: current.descriptionEn,
    takenAt: current.takenAt,
  });
  if (layoutWillPatch) {
    Object.assign(patchBody, input.layout);
    if (input.cropAspectFormat) {
      patchBody.cropAspectFormat = input.cropAspectFormat;
    }
  }

  lastPhase = "patch";
  photoEditorTrace(trace, "save.patch.start", {
    mediaId: current.id,
    patchBody,
  }, "debug");
  const res = await fetchWithNetworkRetry(
    `/api/posts/${input.postId}/images/${current.id}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patchBody),
    },
    { retries: 4, baseDelayMs: 600 }
  );
  if (!res.ok) {
    const errBody = await readMediaApiError(res);
    photoEditorTrace(trace, "save.patch.failed", {
      status: res.status,
      ...errBody,
    }, "error");
    const detail =
      typeof errBody.error === "string"
        ? errBody.error
        : typeof errBody.detail === "string"
          ? errBody.detail
          : undefined;
    const serverTrace =
      typeof errBody.traceId === "string" ? errBody.traceId : trace.traceId;
    throw new MediaSaveFlowError(
      detail ? `${detail} (${serverTrace})` : `patch failed (${serverTrace})`,
      "patch"
    );
  }

  const updated = toEditorImage(await res.json()) as GalleryEditorImage & {
    rebakePending?: boolean;
  };
  const patchVariantBaseline = mediaVariantSnapshot(updated);
  photoEditorTrace(trace, "save.patch.done", {
    mediaId: current.id,
    scaleX: updated.scaleX,
    scaleY: updated.scaleY,
    rotation: updated.rotation,
    rebakePending: Boolean(updated.rebakePending),
    urlPicto: updated.urlPicto,
  }, "info");

  const saved = isImage
    ? mergeEditorImageLayout(updated, input.layout, {
        cropAspectFormat: input.cropAspectFormat ?? updated.cropAspectFormat,
      })
    : updated;

  return {
    saved,
    layoutPatched: layoutWillPatch,
    patchVariantBaseline: layoutWillPatch ? patchVariantBaseline : null,
    lastPhase,
    rebakePending: updated.rebakePending,
  };
}

async function saveLibraryMedia(input: LibrarySaveMediaInput): Promise<SaveMediaFlowResult> {
  let lastPhase: SaveMediaFlowPhase = "patch";

  if (input.mode === "create") {
    if (!input.pendingFile) {
      throw new MediaSaveFlowError(input.messages.fileRequired, "upload");
    }
    lastPhase = "upload";
    const uploadFile = await prepareUploadFile(
      input.pendingFile,
      input.effectiveKind
    );
    const buildCreateBody = () => {
      const fd = new FormData();
      fd.set("file", uploadFile);
      buildMetadataFormFields(input.metadata, fd);
      return fd;
    };
    const res = await uploadFormDataWithRetry("/api/media-library", buildCreateBody);
    const data = await readMediaApiError(res);
    if (!res.ok) {
      throw new MediaSaveFlowError(
        libraryUploadRejectedMessage(input, res, data),
        "upload"
      );
    }
    if (typeof data.urlOrigin === "string") {
      try {
        assertLocalOriginUrl(data.urlOrigin, input.locale);
      } catch {
        throw new MediaSaveFlowError(input.messages.localStorageRequired, "upload");
      }
    }

    let saved = toEditorImage(data);
    const isImage = data.kind === "IMAGE" || input.effectiveKind === "IMAGE";

    if (isImage && saved.id) {
      lastPhase = "patch";
      const layoutRes = await fetchWithNetworkRetry(
        `/api/media-library/${saved.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...input.layout,
            ...(input.cropAspectFormat
              ? { cropAspectFormat: input.cropAspectFormat }
              : {}),
          }),
        },
        { retries: 4, baseDelayMs: 600 }
      );
      if (!layoutRes.ok) {
        throw new MediaSaveFlowError(input.messages.saveError, "patch");
      }
      saved = toEditorImage(await layoutRes.json());
    }

    return {
      saved,
      layoutPatched: isImage,
      patchVariantBaseline: null,
      lastPhase,
    };
  }

  if (!input.mediaId) {
    throw new MediaSaveFlowError(input.messages.saveError, "patch");
  }

  const mediaId = input.mediaId;
  const effectiveKind = input.pendingFile
    ? (input.effectiveKind ?? "IMAGE")
    : input.effectiveKind;
  const layoutChanged = input.layoutChanged;
  const patchBody: Record<string, unknown> = metadataPatchBody(input.metadata);

  if (
    effectiveKind === "IMAGE" &&
    (input.pendingFile || input.originEditable)
  ) {
    if (input.pendingFile || layoutChanged) {
      Object.assign(patchBody, input.layout);
      if (input.cropAspectFormat) {
        patchBody.cropAspectFormat = input.cropAspectFormat;
      }
    }
  }

  if (input.pendingFile) {
    lastPhase = "upload";
    const uploadFile = await prepareUploadFile(
      input.pendingFile,
      effectiveKind
    );
    const rep = await uploadFormDataWithRetry(
      `/api/media-library/${mediaId}/replace`,
      () => {
        const fd = new FormData();
        fd.set("file", uploadFile);
        return fd;
      }
    );
    if (!rep.ok) {
      const repData = await readMediaApiError(rep);
      throw new MediaSaveFlowError(
        libraryUploadRejectedMessage(input, rep, repData),
        "upload"
      );
    }
    const replaced = await readMediaApiError(rep);
    if (typeof replaced.urlOrigin === "string") {
      try {
        assertLocalOriginUrl(replaced.urlOrigin, input.locale);
      } catch {
        throw new MediaSaveFlowError(input.messages.localStorageRequired, "upload");
      }
    }
  }

  lastPhase = "patch";
  const res = await fetchWithNetworkRetry(
    `/api/media-library/${mediaId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patchBody),
    },
    { retries: 4, baseDelayMs: 600 }
  );
  const data = await readMediaApiError(res);
  if (!res.ok) {
    throw new MediaSaveFlowError(
      errorMessageFromApiBody(data, input.messages.saveError),
      "patch"
    );
  }

  const saved = toEditorImage(data);
  const layoutPatched =
    effectiveKind === "IMAGE" &&
    (Boolean(input.pendingFile) || input.originEditable) &&
    (Boolean(input.pendingFile) || layoutChanged);
  const patchVariantBaseline = layoutPatched
    ? mediaVariantSnapshot({
        urlPicto: (data.urlPicto as string | null) ?? null,
        urlPetite: (data.urlPetite as string | null) ?? null,
        urlMoyenne: (data.urlMoyenne as string | null) ?? null,
        urlGrande: (data.urlGrande as string | null) ?? null,
      })
    : null;

  return {
    saved,
    layoutPatched,
    patchVariantBaseline,
    lastPhase,
  };
}

export async function saveMediaFlow(
  input: SaveMediaFlowInput
): Promise<SaveMediaFlowResult> {
  if (input.strategy === "post") {
    return savePostMedia(input);
  }
  return saveLibraryMedia(input);
}

/** Post editor: refresh gallery after async rebake (modal already closed). */
export function followUpPostRebakePoll(opts: {
  mediaId: string;
  layout: ImageLayoutParams;
  isImage: boolean;
  patchVariantBaseline: MediaVariantSnapshot;
  trace: PhotoEditorTraceContext;
  onSaved: (image: GalleryEditorImage) => void;
  cropAspectFormat?: string;
}): void {
  const {
    mediaId,
    layout,
    isImage,
    patchVariantBaseline,
    trace,
    onSaved,
    cropAspectFormat,
  } = opts;
  photoEditorTrace(trace, "save.rebake.poll.start", {
    mediaId,
    baseline: patchVariantBaseline,
  }, "info");
  void (async () => {
    const rebaked =
      (await waitForMediaRebakeAfterPatch<GalleryEditorImage>(
        mediaId,
        patchVariantBaseline,
        { maxMs: 20_000 }
      )) ??
      (await fetchMediaAfterRebakeTimeout<GalleryEditorImage>(mediaId));
    if (!rebaked || !mediaVariantsChanged(patchVariantBaseline, rebaked)) {
      if (!rebaked) {
        photoEditorTrace(trace, "save.rebake.poll.timeout", { mediaId }, "warn");
      }
      return;
    }
    photoEditorTrace(trace, "save.rebake.poll.done", {
      mediaId,
      urlPicto: rebaked.urlPicto,
      urlPetite: rebaked.urlPetite,
    }, "info");
    onSaved(
      isImage
        ? mergeEditorImageLayout(toEditorImage(rebaked), layout, {
            cropAspectFormat:
              cropAspectFormat ?? toEditorImage(rebaked).cropAspectFormat,
          })
        : toEditorImage(rebaked)
    );
  })();
}

/** Library: reload list after async rebake rotates variant URLs. */
export function followUpLibraryRebakePoll(opts: {
  mediaId: string;
  patchVariantBaseline: MediaVariantSnapshot;
  onReload: () => void | Promise<void>;
}): void {
  void (async () => {
    const rebaked =
      (await waitForMediaRebakeAfterPatch(opts.mediaId, opts.patchVariantBaseline, {
        maxMs: 20_000,
      })) ??
      (await fetchMediaAfterRebakeTimeout(opts.mediaId));
    if (rebaked && mediaVariantsChanged(opts.patchVariantBaseline, rebaked)) {
      await opts.onReload();
      return;
    }
    if (!rebaked) {
      await opts.onReload();
    }
  })();
}

export function getSaveFlowErrorPhase(err: unknown): SaveMediaFlowPhase {
  if (err instanceof MediaSaveFlowError) return err.phase;
  return "patch";
}
