import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  pasteImageFromClipboard,
  type ClipboardPasteError,
} from "@/lib/media-file-client";
import { isLocalMediaUrl } from "@/lib/media-integrity-shared";

describe("pasteImageFromClipboard", () => {
  const originalClipboard = navigator.clipboard;

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: originalClipboard,
    });
    vi.restoreAllMocks();
  });

  it("returns unsupported when Clipboard API is missing", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    const result = await pasteImageFromClipboard();
    expect(result).toEqual({ ok: false, error: "unsupported" });
  });

  it("returns image file from clipboard blob", async () => {
    const blob = new Blob(["fake"], { type: "image/png" });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        read: vi.fn(async () => [
          {
            types: ["image/png"],
            getType: vi.fn(async () => blob),
          },
        ]),
      },
    });

    const result = await pasteImageFromClipboard();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.file.type).toBe("image/png");
      expect(result.file.name).toMatch(/^clipboard-\d+\.png$/);
    }
  });

  it("ignores text/URL clipboard entries", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        read: vi.fn(async () => [
          {
            types: ["text/plain"],
            getType: vi.fn(async () => new Blob(["https://example.com/x.jpg"])),
          },
        ]),
      },
    });

    const result = await pasteImageFromClipboard();
    expect(result).toEqual({ ok: false, error: "not_image" satisfies ClipboardPasteError });
  });

  it("returns permission when read is denied", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        read: vi.fn(async () => {
          throw new DOMException("denied", "NotAllowedError");
        }),
      },
    });

    const result = await pasteImageFromClipboard();
    expect(result).toEqual({ ok: false, error: "permission" });
  });
});

describe("isLocalMediaUrl (shared)", () => {
  it("accepts /media paths only", () => {
    expect(isLocalMediaUrl("/media/2026/07/foo.jpg")).toBe(true);
    expect(isLocalMediaUrl("https://example.com/media/x.jpg")).toBe(false);
    expect(isLocalMediaUrl("http://blogger.googleusercontent.com/x.jpg")).toBe(
      false
    );
  });
});
