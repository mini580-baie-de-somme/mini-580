import { describe, expect, it, vi, afterEach } from "vitest";
import { DEFAULT_IMAGE_LAYOUT } from "@/lib/image-layout";
import {
  errorMessageFromApiBody,
  formatMediaSaveError,
  MediaSaveFlowError,
  readMediaApiError,
  wrapMediaSaveErrorMessage,
} from "@/lib/media-save-errors";
import {
  followUpLibraryRebakePoll,
  getSaveFlowErrorPhase,
  saveMediaFlow,
} from "@/lib/save-media-flow";
import { validateMediaFile } from "@/hooks/useMediaFileQueue";

describe("readMediaApiError", () => {
  it("parses JSON error bodies", async () => {
    const res = new Response(JSON.stringify({ error: "bad", detail: "x" }), {
      status: 400,
    });
    const body = await readMediaApiError(res);
    expect(body.error).toBe("bad");
    expect(body.detail).toBe("x");
  });

  it("maps 413 to PAYLOAD_TOO_LARGE", async () => {
    const res = new Response("not json", { status: 413 });
    const body = await readMediaApiError(res);
    expect(body.error).toBe("PAYLOAD_TOO_LARGE");
  });
});

describe("formatMediaSaveError", () => {
  it("maps network errors to upload message", () => {
    const err = new TypeError("Failed to fetch");
    expect(formatMediaSaveError(err, "en", "upload")).toContain("upload interrupted");
  });

  it("wraps generic errors", () => {
    expect(
      wrapMediaSaveErrorMessage("Something broke", "en")
    ).toBe("Save failed — Something broke");
  });
});

describe("errorMessageFromApiBody", () => {
  it("prefers detail over error", () => {
    expect(
      errorMessageFromApiBody({ detail: "d", error: "e" }, "fallback")
    ).toBe("d");
  });
});

describe("validateMediaFile", () => {
  it("rejects disallowed types", () => {
    const file = new File(["x"], "x.txt", { type: "text/plain" });
    expect(
      validateMediaFile(file, {
        messages: {
          fileInvalid: "invalid",
          fileTooLarge: "big",
          fileTooLargeVideo: "video",
        },
      })
    ).toBe("invalid");
  });

  it("rejects cover non-image", () => {
    const file = new File(["x"], "x.pdf", { type: "application/pdf" });
    expect(
      validateMediaFile(file, {
        imagesOnly: true,
        messages: {
          coverMustBePhoto: "photo only",
          fileInvalid: "invalid",
          fileTooLarge: "big",
          fileTooLargeVideo: "video",
        },
      })
    ).toBe("photo only");
  });
});

describe("saveMediaFlow library edit", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("patches metadata without layout when unchanged", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "m1",
            kind: "IMAGE",
            urlOrigin: "/media/m1/origin.jpg",
            titleFr: "t",
            titleEn: "",
            descriptionFr: "",
            descriptionEn: "",
            takenAt: null,
            urlPicto: "/media/m1/picto.webp",
            urlPetite: null,
            urlMoyenne: null,
            urlGrande: null,
          })
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await saveMediaFlow({
      strategy: "library",
      mode: "edit",
      mediaId: "m1",
      pendingFile: null,
      effectiveKind: "IMAGE",
      metadata: {
        titleFr: "t",
        titleEn: "",
        descriptionFr: "",
        descriptionEn: "",
        takenAt: null,
      },
      layout: { ...DEFAULT_IMAGE_LAYOUT, scaleX: 1.1 },
      originEditable: true,
      layoutChanged: false,
      locale: "en",
      messages: {
        saveError: "save error",
        uploadRejected: "upload rejected",
        localStorageRequired: "local required",
        fileRequired: "file required",
      },
    });

    expect(result.saved.id).toBe("m1");
    expect(result.layoutPatched).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init?.method).toBe("PATCH");
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body.titleFr).toBe("t");
    expect(body.scaleX).toBeUndefined();
  });

  it("includes layout in PATCH when changed", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "m1",
          kind: "IMAGE",
          urlOrigin: "/media/m1/origin.jpg",
          titleFr: "t",
          titleEn: "",
          descriptionFr: "",
          descriptionEn: "",
          takenAt: null,
          urlPicto: "/media/m1/picto.webp",
          urlPetite: null,
          urlMoyenne: null,
          urlGrande: null,
          scaleX: 1.2,
        })
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const layout = { ...DEFAULT_IMAGE_LAYOUT, scaleX: 1.2 };
    const result = await saveMediaFlow({
      strategy: "library",
      mode: "edit",
      mediaId: "m1",
      pendingFile: null,
      effectiveKind: "IMAGE",
      metadata: {
        titleFr: "t",
        titleEn: "",
        descriptionFr: "",
        descriptionEn: "",
        takenAt: null,
      },
      layout,
      originEditable: true,
      layoutChanged: true,
      locale: "en",
      messages: {
        saveError: "save error",
        uploadRejected: "upload rejected",
        localStorageRequired: "local required",
        fileRequired: "file required",
      },
    });

    expect(result.layoutPatched).toBe(true);
    expect(result.patchVariantBaseline).toEqual({
      urlPicto: "/media/m1/picto.webp",
      urlPetite: null,
      urlMoyenne: null,
      urlGrande: null,
    });
    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body.scaleX).toBe(1.2);
  });
});

describe("saveMediaFlow post editor", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("includes cropAspectFormat in post image PATCH", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "m1",
          kind: "IMAGE",
          urlOrigin: "/media/m1/origin.jpg",
          titleFr: "t",
          titleEn: "",
          descriptionFr: "",
          descriptionEn: "",
          takenAt: null,
          urlPicto: "/media/m1/picto.webp",
          urlPetite: null,
          urlMoyenne: null,
          urlGrande: null,
          cropAspectFormat: "LANDSCAPE_16_9",
        })
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await saveMediaFlow({
      strategy: "post",
      postId: "post-1",
      draft: {
        id: "m1",
        kind: "IMAGE",
        urlOrigin: "/media/m1/origin.jpg",
        urlPicto: "/media/m1/picto.webp",
        urlPetite: null,
        urlMoyenne: null,
        urlGrande: null,
        titleFr: "t",
        titleEn: "",
        descriptionFr: "",
        descriptionEn: "",
        takenAt: null,
        sortOrder: 0,
        offsetX: 0,
        offsetY: 0,
        scaleX: 1,
        scaleY: 1,
        lockAspect: true,
        cropShape: "RECT",
        backgroundColor: "#000000",
        cropInset: 0.06,
        focusX: 0.5,
        focusY: 0.5,
        zoom: 1,
        rotation: 0,
        cropX: 0,
        cropY: 0,
        cropW: 1,
        cropH: 1,
      },
      pendingFile: null,
      effectiveKind: "IMAGE",
      metadata: {
        titleFr: "t",
        titleEn: "",
        descriptionFr: "",
        descriptionEn: "",
        takenAt: null,
      },
      layout: { ...DEFAULT_IMAGE_LAYOUT },
      cropAspectFormat: "LANDSCAPE_16_9",
      canEditImageLayout: true,
      locale: "fr",
      trace: { traceId: "t-post-crop", postId: "post-1", mediaId: "m1" },
    });

    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body.cropAspectFormat).toBe("LANDSCAPE_16_9");
  });
});

describe("getSaveFlowErrorPhase", () => {
  it("reads phase from MediaSaveFlowError", () => {
    expect(
      getSaveFlowErrorPhase(new MediaSaveFlowError("x", "upload"))
    ).toBe("upload");
  });
});

describe("followUpLibraryRebakePoll", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reloads when rebake completes with new variant URLs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "m1",
          urlPicto: "/media/m1/picto-new.webp",
        })
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const onReload = vi.fn();
    followUpLibraryRebakePoll({
      mediaId: "m1",
      patchVariantBaseline: { urlPicto: "/media/m1/picto.webp" },
      onReload,
    });
    await vi.waitFor(() => expect(onReload).toHaveBeenCalled());
  });

  it("reloads when rebake times out", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "m1",
          urlPicto: "/media/m1/picto.webp",
        })
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const onReload = vi.fn();
    followUpLibraryRebakePoll({
      mediaId: "m1",
      patchVariantBaseline: { urlPicto: "/media/m1/picto.webp" },
      onReload,
    });
    await vi.advanceTimersByTimeAsync(25_000);
    expect(onReload).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
